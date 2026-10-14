package dev.souschef.app

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Labels a receipt's lines with Gemini Nano through ML Kit GenAI; the Android
 * half of `src/native/ReceiptStructuring.ts`, answering in the iOS module's
 * shape. Like iOS, the model only labels: the figures are read in JS.
 */
class ReceiptStructuringModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

  override fun getName(): String = NAME

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  @ReactMethod
  fun availability(promise: Promise) {
    // The library's minSdk (26) is overridden in the manifest; below it, never call in.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve("unavailable")
      return
    }
    scope.launch(settleOnFailure(promise)) {
      // A device without AICore can throw creating the client: unavailable too.
      val model = runCatching { Generation.getClient() }.getOrNull()
      val status = model?.let { client ->
        try {
          runCatching { client.checkStatus() }.getOrNull()
        } finally {
          client.close()
        }
      }
      promise.resolve(
        when (status) {
          FeatureStatus.AVAILABLE -> "available"
          // A scan never starts the download on the user's data plan.
          FeatureStatus.DOWNLOADABLE, FeatureStatus.DOWNLOADING -> "downloading"
          else -> "unavailable"
        },
      )
    }
  }

  @ReactMethod
  fun labelLines(lines: ReadableArray, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.reject("receipt_structuring_unavailable", "Gemini Nano needs Android 8 or later")
      return
    }
    val texts = (0 until lines.size()).map { lines.getString(it) ?: "" }
    scope.launch(settleOnFailure(promise)) {
      val model = try {
        Generation.getClient()
      } catch (error: Exception) {
        promise.reject("receipt_structuring_unavailable", error.message, error)
        return@launch
      }
      try {
        val request = generateContentRequest(TextPart(prompt(texts))) {
          temperature = 0f
          topK = 1
        }
        val reply = model.generateContent(request).candidates.firstOrNull()?.text.orEmpty()
        promise.resolve(toLabels(reply))
      } catch (error: Exception) {
        promise.reject("receipt_structuring_failed", error.message, error)
      } finally {
        model.close()
      }
    }
  }

  // Whatever escapes a launch settles its promise rather than reaching the
  // thread's uncaught handler, which would end the app.
  private fun settleOnFailure(promise: Promise) =
    CoroutineExceptionHandler { _, error ->
      promise.reject("receipt_structuring_failed", error.message, error)
    }

  private fun prompt(lines: List<String>): String {
    val numbered = lines.mapIndexed { index, line -> "$index: $line" }.joinToString("\n")
    return """
      |Label every line of this grocery receipt, in order, one label per line number. Do not skip or merge lines.
      |Kinds: item (a product bought), itemDetail (a weight or count line belonging to a product), discount (savings or coupon), tax, subtotal, total, payment, header (store name, address, phone), other.
      |Reply with JSON only: {"storeName": string or null, "lines": [{"line": number, "kind": kind, "product": for an item line only, the product words as printed without codes, prices or tax flags}]}
      |
      |$numbered
    """.trimMargin()
  }

  // Gemini Nano may wrap its JSON in prose or a code fence; JS validates each label.
  private fun toLabels(reply: String): WritableMap {
    val start = reply.indexOf('{')
    val end = reply.lastIndexOf('}')
    val json = if (start >= 0 && end > start) JSONObject(reply.substring(start, end + 1)) else JSONObject()

    // Filled before `putArray`, which consumes the native array.
    val labels = Arguments.createArray()
    val lines = json.optJSONArray("lines")
    for (index in 0 until (lines?.length() ?: 0)) {
      val line = lines?.optJSONObject(index) ?: continue
      if (!line.has("line")) continue
      labels.pushMap(
        Arguments.createMap().apply {
          putInt("line", line.optInt("line"))
          putString("kind", line.optString("kind"))
          line.optString("product").takeIf { it.isNotBlank() && it != "null" }?.let {
            putString("product", it)
          }
        },
      )
    }

    return Arguments.createMap().apply {
      json.optString("storeName").takeIf { it.isNotBlank() && it != "null" }?.let {
        putString("storeName", it)
      }
      putArray("lines", labels)
    }
  }

  companion object {
    const val NAME = "ReceiptStructuringModule"
  }
}
