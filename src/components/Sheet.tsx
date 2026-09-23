"use client";

import { useEffect, useRef, useState } from "react";

// A <dialog> sheet that still works in browsers where showModal is missing or throws
// (older WKWebView based browsers such as Ecosia on iOS): it then falls back to an open,
// fixed position dialog with its own backdrop and Escape handling. The content scrolls
// inside the sheet, and the close button stays pinned at the top of that scroll area.
export default function Sheet({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [fallback, setFallback] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (d.open) return;
      let modal = false;
      if (typeof d.showModal === "function") {
        try {
          d.showModal();
          modal = true;
        } catch {
          modal = false;
        }
      }
      if (!modal) {
        d.setAttribute("open", "");
        setFallback(true);
      }
      const html = document.documentElement;
      const prev = html.style.overflow;
      html.style.overflow = "hidden";
      return () => {
        html.style.overflow = prev;
      };
    } else if (d.open || d.hasAttribute("open")) {
      if (typeof d.close === "function") {
        try {
          d.close();
        } catch {
          d.removeAttribute("open");
        }
      } else d.removeAttribute("open");
      setFallback(false);
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handleClose = () => onCloseRef.current();
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    d.addEventListener("close", handleClose);
    d.addEventListener("cancel", handleCancel);
    return () => {
      d.removeEventListener("close", handleClose);
      d.removeEventListener("cancel", handleCancel);
    };
  }, []);

  useEffect(() => {
    if (!fallback || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fallback, open]);

  return (
    <>
      {fallback && open && <div className="sheet-backdrop" aria-hidden="true" onClick={() => onCloseRef.current()} />}
      <dialog
        ref={ref}
        className={`sheet${fallback ? " sheet-fallback" : ""}`}
        aria-labelledby={labelledBy}
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCloseRef.current();
        }}
      >
        <div className="sheet-scroll">
          <div className="sheet-bar">
            <button type="button" className="close" aria-label="Close" onClick={() => onCloseRef.current()}>
              ×
            </button>
          </div>
          <div className="sheet-in">{open && children}</div>
        </div>
      </dialog>
    </>
  );
}
