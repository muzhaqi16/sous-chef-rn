import Foundation
import Vision
import React

/// On-device text recognition with Apple Vision; the iOS half of
/// `src/native/TextRecognition.ts`. Google ML Kit is not used on iOS: its pods
/// ship no arm64-simulator slice (`docs/verified-library-behaviour.md`).
@objc(TextRecognitionModule)
class TextRecognitionModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  /// Reads every page, then deletes the pages and any scan the document
  /// scanner left in Documents, which iCloud backs up.
  @objc func recognizeAndDelete(
    _ imageUris: [String],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      let urls = imageUris.compactMap(Self.fileURL)
      defer { Self.delete(urls) }
      do {
        resolve(try urls.map(Self.recognize))
      } catch {
        reject("text_recognition_failed", error.localizedDescription, error)
      }
    }
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
    let files = FileManager.default
    for url in urls { try? files.removeItem(at: url) }
    // react-native-document-scanner-plugin names its pages DOCUMENT_SCAN_<n>_<time>.jpg.
    guard
      let documents = files.urls(for: .documentDirectory, in: .userDomainMask).first,
      let leftovers = try? files.contentsOfDirectory(
        at: documents, includingPropertiesForKeys: nil)
    else { return }
    for url in leftovers where url.lastPathComponent.hasPrefix("DOCUMENT_SCAN_") {
      try? files.removeItem(at: url)
    }
  }
}
