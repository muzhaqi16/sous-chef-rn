import Foundation
import ImageIO
import React
import UniformTypeIdentifiers
import Vision

/// On-device text recognition with Apple Vision; the iOS half of
/// `src/native/TextRecognition.ts`. Google ML Kit is not used on iOS: its pods
/// ship no arm64-simulator slice (`docs/verified-library-behaviour.md`).
@objc(TextRecognitionModule)
class TextRecognitionModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Reads every page, then deletes the pages and any scan the document
  /// scanner left in Documents, which iCloud backs up. A failed read keeps its
  /// pages: the caller sends them (`preparePhotos`) or deletes them.
  @objc func recognizeAndDelete(
    _ imageUris: [String],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.queue.async {
      let urls = imageUris.compactMap(Self.fileURL)
      let pages: [[String: Any]]
      do {
        pages = try urls.map { url in try autoreleasepool { try Self.recognize(url) } }
      } catch {
        Self.sweep(keeping: urls)
        reject("text_recognition_failed", error.localizedDescription, error)
        return
      }
      Self.delete(urls)
      Self.sweep(keeping: [])
      resolve(pages)
    }
  }

  /// Each page as an upright JPEG of at most `photoEdge` px with no metadata,
  /// for the server to read: it refuses one over 4000 px and reads at 2048.
  /// Anything written is deleted on a failure; the pages are deleted too unless
  /// `keepPages`, which leaves them for `recognizeAndDelete`.
  @objc func preparePhotos(
    _ imageUris: [String],
    keepPages: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.queue.async {
      let urls = imageUris.compactMap(Self.fileURL)
      defer { if !keepPages { Self.delete(urls) } }
      var written: [URL] = []
      do {
        for url in urls {
          written.append(try autoreleasepool { try Self.prepare(url) })
        }
      } catch {
        Self.delete(written)
        reject("photo_preparation_failed", error.localizedDescription, error)
        return
      }
      Self.handedOut.add(written)
      resolve(written.map(Self.describe))
    }
  }

  @objc func deletePhotos(
    _ imageUris: [String],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.delete(imageUris.compactMap(Self.fileURL))
    resolve(nil)
  }

  // Serial, so the photos of a scan are prepared before its pages are read and
  // deleted, and only one full-size page is decoded at a time.
  private static let queue = DispatchQueue(label: "dev.souschef.TextRecognition", qos: .userInitiated)
  private static let photoEdge = 2048
  private static let photoPrefix = "RECEIPT_PHOTO_"
  // Photos still with JS (going up) are not leftovers, until `deletePhotos`.
  private static let handedOut = PhotoPaths()

  private struct UnreadableImage: Error {}

  private final class PhotoPaths: @unchecked Sendable {
    private let lock = NSLock()
    private var paths = Set<String>()

    func add(_ urls: [URL]) { update { $0.formUnion(urls.map(\.standardizedFileURL.path)) } }
    func remove(_ urls: [URL]) { update { $0.subtract(urls.map(\.standardizedFileURL.path)) } }
    func contains(_ url: URL) -> Bool {
      lock.lock()
      defer { lock.unlock() }
      return paths.contains(url.standardizedFileURL.path)
    }

    private func update(_ change: (inout Set<String>) -> Void) {
      lock.lock()
      defer { lock.unlock() }
      change(&paths)
    }
  }

  /// Decoded at the photo's size, never the page's, with its orientation
  /// applied; written without the page's metadata (location, camera, time).
  private static func prepare(_ url: URL) throws -> URL {
    let thumbnail: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceThumbnailMaxPixelSize: photoEdge,
    ]
    guard
      let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first,
      let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnail as CFDictionary)
    else { throw UnreadableImage() }
    let photo = caches.appendingPathComponent("\(photoPrefix)\(UUID().uuidString).jpg")
    guard
      let destination = CGImageDestinationCreateWithURL(
        photo as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
    else { throw UnreadableImage() }
    let quality: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: 0.8]
    CGImageDestinationAddImage(destination, image, quality as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
      try? FileManager.default.removeItem(at: photo)
      throw UnreadableImage()
    }
    return photo
  }

  private static func describe(_ photo: URL) -> [String: Any] {
    let size = (try? photo.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
    return ["uri": photo.absoluteString, "fileSize": size]
  }

  private static func fileURL(_ uri: String) -> URL? {
    if let url = URL(string: uri), url.isFileURL { return url }
    return uri.hasPrefix("/") ? URL(fileURLWithPath: uri) : nil
  }

  private static func recognize(_ url: URL) throws -> [String: Any] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    // Correction rewrites receipt abbreviations and codes into dictionary words.
    request.usesLanguageCorrection = false
    // Vision reads the file's EXIF orientation itself when given a URL.
    try VNImageRequestHandler(url: url, options: [:]).perform([request])

    let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
      guard let text = observation.topCandidates(1).first?.string else { return nil }
      let box = observation.boundingBox
      // The rise of the line's top edge per unit across, down positive: a tilted
      // photo's rows are read along it (assembleReceiptLines.ts).
      let run = observation.topRight.x - observation.topLeft.x
      let slope = run > 0 ? (observation.topLeft.y - observation.topRight.y) / run : 0
      // Vision's origin is bottom-left; the bridge's is top-left.
      return [
        "text": text,
        "x": box.minX,
        "y": 1 - box.maxY,
        "width": box.width,
        "height": box.height,
        "slope": slope,
      ]
    }
    return ["lines": lines]
  }

  private static func delete(_ urls: [URL]) {
    for url in urls { try? FileManager.default.removeItem(at: url) }
    handedOut.remove(urls)
  }

  /// Pages and photos an earlier scan left behind (the app was killed before
  /// they were read, sent or refused), except `keeping` and photos going up.
  private static func sweep(keeping: [URL]) {
    let files = FileManager.default
    let kept = Set(keeping.map { $0.standardizedFileURL.path })
    // react-native-document-scanner-plugin names its pages DOCUMENT_SCAN_<n>_<time>.jpg.
    let places: [(FileManager.SearchPathDirectory, String)] = [
      (.documentDirectory, "DOCUMENT_SCAN_"), (.cachesDirectory, photoPrefix),
    ]
    for (directory, prefix) in places {
      guard
        let folder = files.urls(for: directory, in: .userDomainMask).first,
        let leftovers = try? files.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
      else { continue }
      for url in leftovers
      where url.lastPathComponent.hasPrefix(prefix) && !kept.contains(url.standardizedFileURL.path)
        && !handedOut.contains(url) {
        try? files.removeItem(at: url)
      }
    }
  }
}
