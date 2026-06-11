import Foundation
import StoreKit
import Capacitor

@objc(TaskMoneyIAPPlugin)
public class TaskMoneyIAPPlugin: CAPPlugin {
    private let proProductId = "taskmoney_pro_lifetime"

    @objc func getProStatus(_ call: CAPPluginCall) {
        Task {
            let isPro = await hasProEntitlement()
            call.resolve(["isPro": isPro])
        }
    }

    @objc func purchasePro(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: [proProductId])

                guard let product = products.first else {
                    call.reject("Pro商品が見つかりませんでした。")
                    return
                }

                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    await transaction.finish()

                    call.resolve([
                        "success": true,
                        "isPro": true,
                        "productId": transaction.productID
                    ])

                case .userCancelled:
                    call.resolve([
                        "success": false,
                        "cancelled": true,
                        "isPro": await hasProEntitlement()
                    ])

                case .pending:
                    call.resolve([
                        "success": false,
                        "pending": true,
                        "isPro": await hasProEntitlement()
                    ])

                @unknown default:
                    call.reject("不明な購入結果です。")
                }
            } catch {
                call.reject("購入処理に失敗しました: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let isPro = await hasProEntitlement()

                call.resolve([
                    "success": true,
                    "isPro": isPro
                ])
            } catch {
                call.reject("購入の復元に失敗しました: \(error.localizedDescription)")
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

enum TaskMoneyStoreKitError: Error {
    case failedVerification
}
