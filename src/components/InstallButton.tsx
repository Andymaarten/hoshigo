"use client";

import { promptInstall, useCanInstall } from "@/lib/install";

// Only shown where the browser offers installing (Chrome, Edge, Android).
export default function InstallButton({ className = "btn" }: { className?: string }) {
  const canInstall = useCanInstall();
  if (!canInstall) return null;
  return (
    <button type="button" className={className} onClick={() => promptInstall()}>
      Install hoshigo
    </button>
  );
}
