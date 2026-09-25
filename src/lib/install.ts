"use client";

import { useSyncExternalStore } from "react";
import { track } from "@vercel/analytics";

// Chrome's install prompt arrives once, early, as an event; it is kept here so
// any install button on any page can use it later.
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    track("app_installed");
    deferred = null;
    notify();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => deferred !== null, () => false);
}

export async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

// The exact label of Safari's share sheet item in the phone's own language.
export function iosAddLabel() {
  const lang = typeof navigator === "undefined" ? "en" : navigator.language.toLowerCase();
  if (lang.startsWith("nl")) return "Zet op beginscherm";
  if (lang.startsWith("de")) return "Zum Home-Bildschirm";
  if (lang.startsWith("fr")) return "Sur l’écran d’accueil";
  return "Add to Home Screen";
}

// Real iPhone or iPad Safari, not an app's built in browser (those can't add to the home screen).
export function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Twitter|LinkedInApp|GSA\/|CriOS|FxiOS|EdgiOS|Snapchat|TikTok/.test(ua);
  return ios && /Safari/.test(ua) && !inApp;
}

export const store = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // private mode or blocked storage: the hint may simply show again
    }
  },
};
