package dev.souschef.app

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.util.concurrent.Executors

/**
 * On-device text recognition with ML Kit through Google Play services (the model
 * is not bundled in the APK); the Android half of `src/native/TextRecognition.ts`.
 */
class TextRecognitionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = NAME

  /** Reads every page, then deletes the pages whatever the outcome. */
  @ReactMethod
  fun recognizeAndDelete(imageUris: ReadableArray, promise: Promise) {
    val uris = (0 until imageUris.size()).mapNotNull { imageUris.getString(it) }.map(Uri::parse)
    executor.execute {
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val pages = Arguments.createArray()
        for (uri in uris) pages.pushMap(recognize(recognizer, uri))
        promise.resolve(pages)
      } catch (error: Exception) {
        promise.reject("text_recognition_failed", error.message, error)
      } finally {
        recognizer.close()
        for (uri in uris) uri.path?.takeIf { uri.scheme == "file" }?.let { File(it).delete() }
      }
    }
  }

  private fun recognize(
    recognizer: TextRecognizer,
    uri: Uri,
  ): WritableMap {
    val image = InputImage.fromFilePath(reactApplicationContext, uri)
    val text = Tasks.await(recognizer.process(image))
    // The document scanner writes upright JPEGs, so the boxes normalize by the
    // image's own size.
    val width = image.width.toDouble()
    val height = image.height.toDouble()
    val lines = Arguments.createArray()
    for (block in text.textBlocks) {
      for (line in block.lines) {
        val box = line.boundingBox ?: continue
        lines.pushMap(
          Arguments.createMap().apply {
            putString("text", line.text)
            putDouble("x", box.left / width)
            putDouble("y", box.top / height)
            putDouble("width", box.width() / width)
            putDouble("height", box.height() / height)
          },
        )
      }
    }
    return Arguments.createMap().apply { putArray("lines", lines) }
  }

  companion object {
    const val NAME = "TextRecognitionModule"
  }
}
