import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        if let shortcutItem =
            launchOptions?[UIApplication.LaunchOptionsKey.shortcutItem]
                as? UIApplicationShortcutItem {

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                self.handleShortcutItem(shortcutItem)
            }

            return false
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey : Any] = [:]
    ) -> Bool {

        return ApplicationDelegateProxy.shared.application(
            app,
            open: url,
            options: options
        )
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {

        return ApplicationDelegateProxy.shared.application(
            application,
            continue: userActivity,
            restorationHandler: restorationHandler
        )
    }

    // MARK: - Home Screen Quick Actions

    func application(
        _ application: UIApplication,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {

        handleShortcutItem(shortcutItem)
        completionHandler(true)
    }

    private func handleShortcutItem(
        _ shortcutItem: UIApplicationShortcutItem
    ) {

        switch shortcutItem.type {

        case "quickMemo":

            guard let url = URL(
                string: "taskmoney://inbox?quickMemo=1"
            ) else {
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                UIApplication.shared.open(
                    url,
                    options: [:],
                    completionHandler: nil
                )
            }

        default:
            break
        }
    }
}
