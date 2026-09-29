"use client";

import { useEffect } from "react";
import { markNewsSeen } from "./actions";

/** Marks news as seen once the page has shown it. */
export default function NewsSeen() {
  useEffect(() => {
    markNewsSeen().catch(() => {});
  }, []);
  return null;
}
