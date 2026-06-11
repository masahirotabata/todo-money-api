#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(TaskMoneyIAPPlugin, "TaskMoneyIAP",
           CAP_PLUGIN_METHOD(getProStatus, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(purchasePro, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
)
