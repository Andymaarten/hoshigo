"use client";

import { savePushSubscription } from "@/lib/push-actions";

// The one subscribe flow, shared by settings (PushSetting) and the first open card
// (PushAsk). Must be called straight from a tap: iOS only asks for permission then.

export type SubscribeResult = { ok: true } | { ok: false; reason: "blocked" | "dismissed" | "error"; message?: string };

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return (
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function subscribePush(): Promise<SubscribeResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: permission === "denied" ? "blocked" : "dismissed" };
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    const problem = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
    if (problem) {
      await sub.unsubscribe();
      return { ok: false, reason: "error", message: problem };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "error", message: "Notifications couldn't be turned on here. Try again in a moment." };
  }
}
