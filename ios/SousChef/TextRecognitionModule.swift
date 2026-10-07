import Foundation
import UIKit
import Vision
import React

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
    DispatchQueue.global(qos: .userInitiated).async {
      let urls = imageUris.compactMap(Self.fileURL)
      let pages: [[String: Any]]
      do {
        pages = try urls.map(Self.recognize)
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
  /// for the server to read: it refuses one over 4000 px and reads at 2048. The
  /// pages are deleted whatever the outcome, and so is anything written on a failure.
  @objc func preparePhotos(
    _ imageUris: [String],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      let urls = imageUris.compactMap(Self.fileURL)
      defer { Self.delete(urls) }
      var written: [URL] = []
      do {
        var photos: [[String: Any]] = []
        for url in urls {
          let photo = try Self.prepare(url)
          written.append(photo)
          photos.append(Self.describe(photo))
        }
        resolve(photos)
      } catch {
        Self.delete(written)
        reject("photo_preparation_failed", error.localizedDescription, error)
      }
    }
  }

  /// Reads every page and prepares each as a photo (`preparePhotos`' rules) from
  /// the same full-size page, then deletes the pages once. A half that fails
  /// comes back null; the call fails only when both do.
  @objc func recognizeAndPrepare(
    _ imageUris: [String],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      let urls = imageUris.compactMap(Self.fileURL)
      let pages = try? urls.map(Self.recognize)
      var written: [URL] = []
      var photos: [[String: Any]]? = []
      do {
        for url in urls {
          let photo = try Self.prepare(url)
          written.append(photo)
          photos?.append(Self.describe(photo))
        }
      } catch {
        Self.delete(written)
        written = []
        photos = nil
      }
      Self.delete(urls)
      Self.sweep(keeping: written)
      guard pages != nil || photos != nil else {
        reject("receipt_pages_unreadable", "The pages could be neither read nor prepared", nil)
        return
      }
      let read: [String: Any] = [
        "pages": pages.map { $0 as Any } ?? NSNull(),
        "photos": photos.map { $0 as Any } ?? NSNull(),
      ]
      resolve(read)
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

  private static let photoEdge: CGFloat = 2048
  private static let photoPrefix = "RECEIPT_PHOTO_"

  private struct UnreadableImage: Error {}

  private static func prepare(_ url: URL) throws -> URL {
    guard
      let image = UIImage(contentsOfFile: url.path),
      let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
    else { throw UnreadableImage() }
    // `size` is already in the photo's display orientation, and drawing applies
    // it, so the copy is upright; a drawn image carries no metadata.
    let scale = min(1, photoEdge / max(image.size.width, image.size.height))
    let size = CGSize(
      width: (image.size.width * scale).rounded(),
      height: (image.size.height * scale).rounded())
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let drawn = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
    guard let data = drawn.jpegData(compressionQuality: 0.8) else { throw UnreadableImage() }
    let photo = caches.appendingPathComponent("\(photoPrefix)\(UUID().uuidString).jpg")
    try data.write(to: photo, options: .atomic)
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
  }

  /// Pages and photos an earlier scan left behind (the app was killed before
  /// they were read, sent or refused), except `keeping`.
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
      where url.lastPathComponent.hasPrefix(prefix) && !kept.contains(url.standardizedFileURL.path) {
        try? files.removeItem(at: url)
      }
    }
  }
}
