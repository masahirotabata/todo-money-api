import { Capacitor } from "@capacitor/core";

export type ProStatus = {
  isPro: boolean;
};

export type PurchaseResult = {
  success: boolean;
  isPro: boolean;
  cancelled?: boolean;
  pending?: boolean;
  productId?: string;
  error?: string;
};

const PRO_LOCAL_KEY = "taskmoney_pro_enabled";

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        taskMoneyIAP?: {
          postMessage: (message: unknown) => void;
        };
      };
    };
  }
}

function hasIAPBridge(): boolean {
  return Boolean(window.webkit?.messageHandlers?.taskMoneyIAP);
}

function postIAPMessage(action: string): boolean {
  if (!hasIAPBridge()) {
    console.error("WK IAP bridge is not available", {
      hasWebkit: Boolean(window.webkit),
      hasMessageHandlers: Boolean(window.webkit?.messageHandlers),
      hasTaskMoneyIAP: Boolean(window.webkit?.messageHandlers?.taskMoneyIAP),
    });

    return false;
  }

  window.webkit?.messageHandlers?.taskMoneyIAP?.postMessage({
    action,
  });

  return true;
}

export async function getProStatus(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return localStorage.getItem(PRO_LOCAL_KEY) === "true";
  }

  console.log("WK IAP getProStatus");

  const posted = postIAPMessage("getProStatus");

  if (!posted) {
    return localStorage.getItem(PRO_LOCAL_KEY) === "true";
  }

  // 仮：Swift側の疎通確認中
  return false;
}

export async function purchasePro(): Promise<PurchaseResult> {
  if (!Capacitor.isNativePlatform()) {
    localStorage.setItem(PRO_LOCAL_KEY, "true");

    return {
      success: true,
      isPro: true,
    };
  }

  console.log("WK IAP purchasePro");

  const posted = postIAPMessage("purchasePro");

  if (!posted) {
    return {
      success: false,
      isPro: false,
      error: "IAP bridge is not available",
    };
  }

  // 仮：Swift側の疎通確認中
  return {
    success: false,
    isPro: false,
    pending: true,
  };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      success: true,
      isPro: localStorage.getItem(PRO_LOCAL_KEY) === "true",
    };
  }

  console.log("WK IAP restorePurchases");

  const posted = postIAPMessage("restorePurchases");

  if (!posted) {
    return {
      success: false,
      isPro: false,
      error: "IAP bridge is not available",
    };
  }

  // 仮：Swift側の疎通確認中
  return {
    success: false,
    isPro: false,
    pending: true,
  };
}