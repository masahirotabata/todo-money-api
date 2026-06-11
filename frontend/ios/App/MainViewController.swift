import Foundation
import Capacitor
import WebKit
import StoreKit

class MainViewController: CAPBridgeViewController {

    private let proProductId = "taskmoney_pro_lifetime"

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()

        print("MainViewController loaded")

        if let webView = bridge?.webView {
            webView.configuration.userContentController.add(
                self,
                name: "taskMoneyIAP"
            )
        }
    }

    private func sendResultToWeb(action: String, result: [String: Any]) {
        guard let webView = bridge?.webView else {
            print("WebView not found")
            return
        }

        var payload = result
        payload["action"] = action

        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            print("Failed to serialize IAP result")
            return
        }

        let js = """
        window.dispatchEvent(new CustomEvent("taskMoneyIAPResult", {
          detail: \(json)
        }));
        """

        DispatchQueue.main.async {
            webView.evaluateJavaScript(js) { _, error in
                if let error = error {
                    print("Failed to send IAP result to web: \(error.localizedDescription)")
                }
            }
        }
    }

    private func handleGetProStatus() {
        Task {
            let isPro = await hasProEntitlement()

            sendResultToWeb(action: "getProStatus", result: [
                "success": true,
                "isPro": isPro
            ])
        }
    }

    private func handlePurchasePro() {
        Task {
            do {
                let products = try await Product.products(for: [proProductId])

                guard let product = products.first else {
                    sendResultToWeb(action: "purchasePro", result: [
                        "success": false,
                        "isPro": await hasProEntitlement(),
                        "error": "Pro商品が見つかりませんでした。App Store Connectの商品IDを確認してください。"
                    ])
                    return
                }

                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    await transaction.finish()

                    sendResultToWeb(action: "purchasePro", result: [
                        "success": true,
                        "isPro": true,
                        "productId": transaction.productID
                    ])

                case .userCancelled:
                    sendResultToWeb(action: "purchasePro", result: [
                        "success": false,
                        "cancelled": true,
                        "isPro": await hasProEntitlement()
                    ])

                case .pending:
                    sendResultToWeb(action: "purchasePro", result: [
                        "success": false,
                        "pending": true,
                        "isPro": await hasProEntitlement()
                    ])

                @unknown default:
                    sendResultToWeb(action: "purchasePro", result: [
                        "success": false,
                        "isPro": await hasProEntitlement(),
                        "error": "不明な購入結果です。"
                    ])
                }
            } catch {
                sendResultToWeb(action: "purchasePro", result: [
                    "success": false,
                    "isPro": await hasProEntitlement(),
                    "error": "購入処理に失敗しました: \(error.localizedDescription)"
                ])
            }
        }
    }

    private func handleRestorePurchases() {
        Task {
            do {
                try await AppStore.sync()

                let isPro = await hasProEntitlement()

                sendResultToWeb(action: "restorePurchases", result: [
                    "success": true,
                    "isPro": isPro
                ])
            } catch {
                sendResultToWeb(action: "restorePurchases", result: [
                    "success": false,
                    "isPro": await hasProEntitlement(),
                    "error": "購入の復元に失敗しました: \(error.localizedDescription)"
                ])
            }
        }
    }

    private func hasProEntitlement() async -> Bool {
        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)

                if transaction.productID == proProductId &&
                    transaction.revocationDate == nil {
                    return true
                }
            } catch {
                continue
            }
        }

        return false
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw TaskMoneyStoreKitError.failedVerification

        case .verified(let safe):
            return safe
        }
    }
}

extension MainViewController: WKScriptMessageHandler {

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "taskMoneyIAP" else {
            return
        }

        print("IAP message received")

        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            sendResultToWeb(action: "unknown", result: [
                "success": false,
                "isPro": false,
                "error": "IAP actionが不正です。"
            ])
            return
        }

        switch action {
        case "getProStatus":
            print("getProStatus")
            handleGetProStatus()

        case "purchasePro":
            print("purchasePro")
            handlePurchasePro()

        case "restorePurchases":
            print("restorePurchases")
            handleRestorePurchases()

        default:
            sendResultToWeb(action: action, result: [
                "success": false,
                "isPro": false,
                "error": "未対応のIAP actionです: \(action)"
            ])
        }
    }
}

enum TaskMoneyStoreKitError: Error {
    case failedVerification
}
