"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { linkFromAddHref, viaFromAddHref } from "@/lib/add-link";
import { startAdd } from "./actions";
import Wordmark from "@/components/Wordmark";

// hoshigo.cc/add?url=<anything>. Runs in the browser because only the browser sees the
// full address including a #fragment; the server gets the query without it.
export default function AddPage() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const link = linkFromAddHref(window.location.href);
    track("add_link_opened", { via: viaFromAddHref(window.location.href) });
    startAdd(link)
      .then((path) => router.replace(path.startsWith("/") && !path.startsWith("//") ? path : "/"))
      .catch(() => router.replace("/"));
  }, [router]);

  return (
    <div className="page">
      <header className="hero">
        <Wordmark />
        <p className="lede">Opening your notebook…</p>
      </header>
    </div>
  );
}
