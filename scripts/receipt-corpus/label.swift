// The labelling of ios/SousChef/ReceiptStructuringModule.swift on macOS: the
// same @Generable schema, instructions and greedy sampling; change them together.
// Writes <out-dir>/<id>.json per entry: the labels, or the error it threw.
import Foundation
import FoundationModels

@Generable
enum ReceiptLineKind: String {
  case item, itemDetail, discount, tax, subtotal, total, payment, header, other
}

@Generable
struct LabeledReceiptLine {
  @Guide(description: "The line number shown before the colon")
  var line: Int
  @Guide(description: "item: a product bought. itemDetail: a weight or count line belonging to a product. discount: savings or coupon. header: store name, address, phone. other: anything else")
  var kind: ReceiptLineKind
  @Guide(description: "For an item line only: the product words as printed, without codes, prices or tax flags")
  var product: String?
}

@Generable
struct ReceiptLineLabels {
  var storeName: String?
  var lines: [LabeledReceiptLine]
}

func label(_ lines: [String]) async throws -> [String: Any] {
  let numbered = lines.enumerated().map { "\($0.offset): \($0.element)" }.joined(separator: "\n")
  let session = LanguageModelSession(
    instructions: "Label every line of a grocery receipt, in order, one label per line number. Do not skip or merge lines."
  )
  let labels = try await session.respond(to: numbered, generating: ReceiptLineLabels.self, options: GenerationOptions(sampling: .greedy)).content
  var result: [String: Any] = [
    "lines": labels.lines.map { line -> [String: Any] in
      var entry: [String: Any] = ["line": line.line, "label": line.kind.rawValue]
      if let product = line.product { entry["product"] = product }
      return entry
    },
  ]
  if let storeName = labels.storeName { result["storeName"] = storeName }
  return result
}

@main
struct Labeler {
  static func main() async throws {
    let availability = SystemLanguageModel.default.availability
    print("availability: \(availability)")
    guard case .available = availability else { exit(2) }

    let outDir = CommandLine.arguments[1]
    for path in CommandLine.arguments.dropFirst(2) {
      let data = try Data(contentsOf: URL(fileURLWithPath: path))
      let entry = try JSONSerialization.jsonObject(with: data) as! [String: Any]
      let id = entry["id"] as! String
      let pages = entry["pages"] as! [String]
      let lines = pages.flatMap { $0.split(separator: "\n", omittingEmptySubsequences: false).map(String.init) }
      let started = Date()
      do {
        var result = try await label(lines)
        result["seconds"] = Date().timeIntervalSince(started)
        let out = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
        try out.write(to: URL(fileURLWithPath: "\(outDir)/\(id).json"))
        print("\(id): \(lines.count) lines in \(String(format: "%.1f", Date().timeIntervalSince(started)))s")
      } catch {
        // A refusal is a result too: Apple's guardrails can turn a receipt away.
        let failed: [String: Any] = [
          "error": "\(error)", "seconds": Date().timeIntervalSince(started),
        ]
        let out = try JSONSerialization.data(withJSONObject: failed, options: [.prettyPrinted, .sortedKeys])
        try out.write(to: URL(fileURLWithPath: "\(outDir)/\(id).json"))
        print("\(id): FAILED \(error)")
      }
    }

  }
}
