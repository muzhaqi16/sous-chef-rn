// The recognition of ios/SousChef/TextRecognitionModule.swift on macOS: accurate,
// no language correction, top-left line boxes and each line's slope; change them together. Writes
// <out-dir>/<image name>.json, {"lines":[...]}, per image path.
//
// With --square, each photo is first squared to the receipt, as the document scanner a phone
// runs first does: VNDetectDocumentSegmentationRequest finds the receipt's corners and
// CIPerspectiveCorrection squares it. The JSON then says whether a receipt was found
// ("squared"); a photo with none is recognised whole.
import CoreImage
import Foundation
import Vision

func textRequest() -> VNRecognizeTextRequest {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  return request
}

func lines(of request: VNRecognizeTextRequest) -> [[String: Any]] {
  return (request.results ?? []).compactMap { observation in
    guard let text = observation.topCandidates(1).first?.string else { return nil }
    let box = observation.boundingBox
    let run = observation.topRight.x - observation.topLeft.x
    let slope = run > 0 ? (observation.topLeft.y - observation.topRight.y) / run : 0
    return [
      "text": text, "x": box.minX, "y": 1 - box.maxY, "width": box.width, "height": box.height,
      "slope": slope,
    ]
  }
}

func recognize(_ url: URL) throws -> [[String: Any]] {
  let request = textRequest()
  try VNImageRequestHandler(url: url, options: [:]).perform([request])
  return lines(of: request)
}

struct UnreadableImage: Error {}

/// The photo squared to the receipt in it, or the whole photo when none is found.
func squared(_ url: URL) throws -> (image: CIImage, found: Bool, confidence: Float) {
  guard let image = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) else {
    throw UnreadableImage()
  }
  let detect = VNDetectDocumentSegmentationRequest()
  try VNImageRequestHandler(ciImage: image, options: [:]).perform([detect])
  guard let document = detect.results?.first else { return (image, false, 0) }
  // Vision's corners are fractions of the image with a bottom-left origin, as Core Image's are.
  let extent = image.extent
  func corner(_ point: CGPoint) -> CIVector {
    CIVector(x: extent.minX + point.x * extent.width, y: extent.minY + point.y * extent.height)
  }
  guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { return (image, false, 0) }
  filter.setValue(image, forKey: kCIInputImageKey)
  filter.setValue(corner(document.topLeft), forKey: "inputTopLeft")
  filter.setValue(corner(document.topRight), forKey: "inputTopRight")
  filter.setValue(corner(document.bottomLeft), forKey: "inputBottomLeft")
  filter.setValue(corner(document.bottomRight), forKey: "inputBottomRight")
  guard let output = filter.outputImage, !output.extent.isEmpty else {
    return (image, false, document.confidence)
  }
  return (output, true, document.confidence)
}

func recognizeSquared(_ url: URL) throws -> [String: Any] {
  let (image, found, confidence) = try squared(url)
  let request = textRequest()
  try VNImageRequestHandler(ciImage: image, options: [:]).perform([request])
  return [
    "lines": lines(of: request), "squared": found, "documentConfidence": confidence,
    "width": image.extent.width, "height": image.extent.height,
  ]
}

var arguments = Array(CommandLine.arguments.dropFirst())
let square = arguments.first == "--square"
if square { arguments.removeFirst() }
let outDir = arguments[0]
for path in arguments.dropFirst() { autoreleasepool {
  let url = URL(fileURLWithPath: path)
  let id = url.deletingPathExtension().lastPathComponent
  do {
    let result: [String: Any] = square ? try recognizeSquared(url) : ["lines": try recognize(url)]
    let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted])
    try data.write(to: URL(fileURLWithPath: "\(outDir)/\(id).json"))
    let count = (result["lines"] as? [Any])?.count ?? 0
    let note = square ? ((result["squared"] as? Bool) == true ? " (squared)" : " (no receipt found)") : ""
    print("\(id): \(count) lines\(note)")
  } catch {
    print("\(id): FAILED \(error)")
  }
} }
