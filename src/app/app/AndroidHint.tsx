"use client";

import InstallHintText from "@/components/InstallHintText";
import { useCanInstall } from "@/lib/install";

export default function AndroidHint() {
  const canInstall = useCanInstall();
  return <InstallHintText platform={canInstall ? "prompt" : "android"} />;
}
