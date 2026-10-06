package dev.souschef.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Point
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
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
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.Executors

/**
 * On-device text recognition with ML Kit through Google Play services (the model
 * is not bundled in the APK); the Android half of `src/native/TextRecognition.ts`.
 */
class TextRecognitionModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = NAME

  // A reload builds a new module, so this one's thread would otherwise stay
  // parked for the life of the process. `shutdown`, not `shutdownNow`: a read
  // in flight still finishes and deletes its pages.
  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  /**
   * Reads every page, then deletes the pages and any page an earlier scan left
   * behind. A failed read keeps its pages: the caller sends them ([preparePhotos])
   * or deletes them ([deletePhotos]).
   */
  @ReactMethod
  fun recognizeAndDelete(imageUris: ReadableArray, promise: Promise) {
    val uris = uriList(imageUris)
    if (ocrCrashesHere()) {
      promise.reject("text_recognition_unsupported", "On-device text recognition crashes this emulator")
      return
    }
    executor.execute {
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val pages = Arguments.createArray()
        for (uri in uris) pages.pushMap(recognize(recognizer, uri))
        deleteFiles(uris)
        sweepLeftovers()
        promise.resolve(pages)
      } catch (error: Exception) {
        promise.reject("text_recognition_failed", error.message, error)
      } finally {
        recognizer.close()
      }
    }
  }

  /**
   * Each page as an upright JPEG of at most [PHOTO_EDGE] px with no metadata,
   * for the server to read: it refuses one over 4000 px and reads at 2048. The
   * pages are deleted whatever the outcome, and so is anything written on a failure.
   */
  @ReactMethod
  fun preparePhotos(imageUris: ReadableArray, promise: Promise) {
    val uris = uriList(imageUris)
    executor.execute {
      val written = mutableListOf<File>()
      try {
        val photos = Arguments.createArray()
        for (uri in uris) {
          val photo = prepare(uri)
          written += photo
          photos.pushMap(
            Arguments.createMap().apply {
              putString("uri", Uri.fromFile(photo).toString())
              putDouble("fileSize", photo.length().toDouble())
            },
          )
        }
        promise.resolve(photos)
      } catch (error: Exception) {
        written.forEach { it.delete() }
        promise.reject("photo_preparation_failed", error.message, error)
      } finally {
        deleteFiles(uris)
      }
    }
  }

  @ReactMethod
  fun deletePhotos(imageUris: ReadableArray, promise: Promise) {
    deleteFiles(uriList(imageUris))
    promise.resolve(null)
  }

  private fun uriList(imageUris: ReadableArray): List<Uri> =
    (0 until imageUris.size()).mapNotNull { imageUris.getString(it) }.map(Uri::parse)

  private fun prepare(uri: Uri): File {
    val resolver = reactApplicationContext.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    val longest = maxOf(bounds.outWidth, bounds.outHeight)
    require(longest > 0) { "Not an image" }
    // Decode at the coarsest power-of-two step that still covers PHOTO_EDGE, then scale exactly.
    var sample = 1
    while (longest / (sample * 2) >= PHOTO_EDGE) sample *= 2
    val decoded =
      resolver.openInputStream(uri).use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
      } ?: throw IllegalArgumentException("Not an image")
    // A camera photo can lie on its side with an EXIF orientation; the copy
    // keeps no metadata, so it is turned upright here.
    val orientation =
      resolver.openInputStream(uri)?.use {
        ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      } ?: ExifInterface.ORIENTATION_NORMAL
    val degrees =
      when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
    val scale = minOf(1f, PHOTO_EDGE.toFloat() / maxOf(decoded.width, decoded.height))
    val matrix = Matrix().apply {
      postScale(scale, scale)
      postRotate(degrees)
    }
    val upright = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    val photo = File(reactApplicationContext.cacheDir, "$PHOTO_PREFIX${UUID.randomUUID()}.jpg")
    try {
      FileOutputStream(photo).use { upright.compress(Bitmap.CompressFormat.JPEG, 80, it) }
    } finally {
      if (upright !== decoded) upright.recycle()
      decoded.recycle()
    }
    return photo
  }

  // Play services' text model dies with SIGILL on the arm64 emulator, killing
  // the app (docs/verified-library-behaviour.md); a rejection lets JS fall back.
  private fun ocrCrashesHere(): Boolean =
    Build.HARDWARE == "ranchu" && Build.SUPPORTED_ABIS.firstOrNull() == "arm64-v8a"

  private fun deleteFiles(uris: List<Uri>) {
    for (uri in uris) uri.path?.takeIf { uri.scheme == "file" }?.let { File(it).delete() }
  }

  // A scan the app was killed during leaves its pages in the ML Kit scanner's
  // cache folder, and a photo left unsent stays in the cache; they go with the
  // next read.
  private fun sweepLeftovers() {
    val cache = reactApplicationContext.cacheDir
    File(cache, "mlkit_docscan_ui_client").listFiles()?.forEach { it.delete() }
    cache.listFiles { file -> file.name.startsWith(PHOTO_PREFIX) }?.forEach { it.delete() }
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
            slopeOf(line.cornerPoints, width, height)?.let { putDouble("slope", it) }
          },
        )
      }
    }
    return Arguments.createMap().apply { putArray("lines", lines) }
  }

  // The rise of the line's top edge per unit across, in page fractions, down
  // positive: a tilted photo's rows are read along it (assembleReceiptLines.ts).
  private fun slopeOf(corners: Array<Point>?, width: Double, height: Double): Double? {
    val topLeft = corners?.getOrNull(0) ?: return null
    val topRight = corners.getOrNull(1) ?: return null
    val run = (topRight.x - topLeft.x) / width
    if (run <= 0) return null
    return (topRight.y - topLeft.y) / height / run
  }

  companion object {
    const val NAME = "TextRecognitionModule"
    private const val PHOTO_EDGE = 2048
    private const val PHOTO_PREFIX = "RECEIPT_PHOTO_"
  }
}
