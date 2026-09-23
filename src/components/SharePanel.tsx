"use client";

import { useEffect, useState } from "react";

type Props = {
  handle: string;
  itemId: string;
  title: string;
  by: string | null;
  mine: boolean;
  friendsOnly?: boolean;
};

const IMAGES = [
  { format: "story", label: "Story image" },
  { format: "portrait", label: "Post image" },
] as const;
type Format = (typeof IMAGES)[number]["format"];

// Phones share the image through the native sheet ("Save Image" puts it in Photos, and
// Instagram is listed there); a download would land in Files where Instagram can't see it.
// Desktops, where the share sheet has no Photos or Instagram, keep a plain download.
function canShareImageFiles(): boolean {
  if (typeof navigator.canShare !== "function" || !window.matchMedia("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

// On a private profile the images are never rendered for outsiders, so only the link is offered.
export default function SharePanel({ handle, itemId, mine, friendsOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<Partial<Record<Format, File>>>({});

  const path = `/${handle}/${itemId}`;
  // The panel only renders after a click, so reading browser globals here can't cause a hydration mismatch.
  const onClient = open && typeof window !== "undefined";
  const url = `${onClient ? window.location.origin : "https://hoshigo.cc"}${path}`;
  const shareFiles = onClient && !friendsOnly && canShareImageFiles();

  // iOS only allows navigator.share inside the tap itself, so the images are fetched when
  // the panel opens rather than when a button is pressed.
  useEffect(() => {
    if (!shareFiles) return;
    let cancelled = false;
    for (const { format } of IMAGES) {
      fetch(`${path}/card/${format}`)
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (!blob || cancelled) return;
          const file = new File([blob], `hoshigo-${handle}-${format}.png`, { type: "image/png" });
          setFiles((f) => ({ ...f, [format]: file }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [shareFiles, path, handle]);

  async function shareImage(format: Format) {
    const file = files[format];
    if (!file) return;
    try {
      await navigator.share({ files: [file] });
    } catch {
      // Cancelling the sheet throws AbortError; nothing to tell the user.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="share">
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Share
      </button>
      {open && (
        <div className="share-panel">
          <div className="share-row">
            <button type="button" className="btn" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <span className="link-dest">{url.replace(/^https?:\/\//, "")}</span>
          </div>
          {friendsOnly ? (
            <p className="meta">
              {mine ? "Your page is private, so this link" : "This page is private, so the link"} only opens for
              friends. Others will see just the name and bio.
            </p>
          ) : (
            <>
              <div className="share-label">Images to post</div>
              <div className="share-row">
                {IMAGES.map(({ format, label }) =>
                  shareFiles ? (
                    <button
                      key={format}
                      type="button"
                      className="share-link"
                      disabled={!files[format]}
                      onClick={() => shareImage(format)}
                    >
                      {files[format] ? label : `${label} (preparing)`}
                    </button>
                  ) : (
                    <a key={format} className="share-link" href={`${path}/card/${format}?download`} download>
                      {label}
                    </a>
                  )
                )}
              </div>
              <p className="meta share-hint">
                {shareFiles
                  ? "Opens your phone's share menu. Choose Save Image or Instagram."
                  : "Downloads the image, sized for Instagram."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
