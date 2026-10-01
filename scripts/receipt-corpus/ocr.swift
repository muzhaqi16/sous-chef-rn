// The recognition of ios/SousChef/TextRecognitionModule.swift on macOS: accurate,
// no language correction, top-left line boxes; change them together. Writes
// <out-dir>/<image name>.json, {"lines":[...]}, per image path.
import Foundation
import Vision

func recognize(_ url: URL) throws -> [[String: Any]] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  try VNImageRequestHandler(url: url, options: [:]).perform([request])
  return (request.results ?? []).compactMap { observation in
    guard let text = observation.topCandidates(1).first?.string else { return nil }
    let box = observation.boundingBox
    return ["text": text, "x": box.minX, "y": 1 - box.maxY, "width": box.width, "height": box.height]
  }
}

let outDir = CommandLine.arguments[1]
for path in CommandLine.arguments.dropFirst(2) {
  let url = URL(fileURLWithPath: path)
  let id = url.deletingPathExtension().lastPathComponent
  do {
    let lines = try recognize(url)
    let data = try JSONSerialization.data(withJSONObject: ["lines": lines], options: [.prettyPrinted])
    try data.write(to: URL(fileURLWithPath: "\(outDir)/\(id).json"))
    print("\(id): \(lines.count) lines")
  } catch {
    print("\(id): FAILED \(error)")
  }
}
