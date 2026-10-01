import Foundation
import React
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Labels a receipt's lines with Apple's on-device model; the iOS half of
/// `src/native/ReceiptStructuring.ts`. The model only labels: asked for the
/// whole receipt it invented dates and negated prices, so the numbers are read
/// in JS (`docs/verified-library-behaviour.md`).
@objc(ReceiptStructuringModule)
class ReceiptStructuringModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func availability(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        resolve("available")
      case .unavailable(.modelNotReady):
        resolve("downloading")
      default:
        resolve("unavailable")
      }
      return
    }
    #endif
    resolve("unavailable")
  }

  @objc func labelLines(
    _ lines: [String],
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      Task {
        do {
          resolve(try await ReceiptLabeler.label(lines))
        } catch {
          reject("receipt_structuring_failed", error.localizedDescription, error)
        }
      }
      return
    }
    #endif
    reject("receipt_structuring_unavailable", "On-device labelling needs iOS 26", nil)
  }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
enum ReceiptLineKind: String {
  case item, itemDetail, discount, tax, subtotal, total, payment, header, other
}

@available(iOS 26.0, *)
@Generable
struct LabeledReceiptLine {
  @Guide(description: "The line number shown before the colon")
  var line: Int
  @Guide(description: "item: a product bought. itemDetail: a weight or count line belonging to a product. discount: savings or coupon. header: store name, address, phone. other: anything else")
  var kind: ReceiptLineKind
  @Guide(description: "For an item line only: the product words as printed, without codes, prices or tax flags")
  var product: String?
}

@available(iOS 26.0, *)
@Generable
struct ReceiptLineLabels {
  var storeName: String?
  var lines: [LabeledReceiptLine]
}

@available(iOS 26.0, *)
enum ReceiptLabeler {
  static func label(_ lines: [String]) async throws -> [String: Any] {
    let numbered = lines.enumerated()
      .map { "\($0.offset): \($0.element)" }
      .joined(separator: "\n")
    let session = LanguageModelSession(
      instructions: "Label every line of a grocery receipt, in order, one label per line number. Do not skip or merge lines."
    )
    let labels = try await session.respond(
      to: numbered,
      generating: ReceiptLineLabels.self,
      options: GenerationOptions(sampling: .greedy)
    ).content

    var result: [String: Any] = [
      "lines": labels.lines.map { line -> [String: Any] in
        var entry: [String: Any] = ["line": line.line, "kind": line.kind.rawValue]
        if let product = line.product { entry["product"] = product }
        return entry
      },
    ]
    if let storeName = labels.storeName { result["storeName"] = storeName }
    return result
  }
}
#endif
