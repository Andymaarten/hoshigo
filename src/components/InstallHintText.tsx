"use client";

import { useEffect, useState } from "react";
import { iosAddLabel, promptInstall } from "@/lib/install";
import ShareIcon from "./ShareIcon";

// The owner's wording per platform, shared by the floating hint and the /app page.
// ios: iPhone Safari. prompt: the browser can install with one tap. android: any other
// Android browser, installed through its own menu.
export default function InstallHintText({
  platform,
  onInstalled,
}: {
  platform: "ios" | "prompt" | "android";
  onInstalled?: () => void;
}) {
  const [label, setLabel] = useState("Add to Home Screen");
  useEffect(() => {
    queueMicrotask(() => setLabel(iosAddLabel()));
  }, []);

  if (platform === "ios") {
    return (
      <p>
        <b>hoshigo as an app?</b> Tap <ShareIcon /> and <span className="nowrap">“{label}”</span>
      </p>
    );
  }
  if (platform === "prompt") {
    return (
      <p>
        <b>hoshigo as an app?</b>{" "}
        <button type="button" className="btn install-now" onClick={() => promptInstall().then((ok) => ok && onInstalled?.())}>
          Install
        </button>
      </p>
    );
  }
  return (
    <p>
      <b>hoshigo as an app?</b> Open the browser menu and choose Install or Add to Home screen.
    </p>
  );
}
