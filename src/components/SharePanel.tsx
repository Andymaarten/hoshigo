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

// Opens inline under the Share button. The Story image is fetched as soon as the panel
// opens, because iOS only allows navigator.share right after a tap: awaiting a slow image
// between the tap and the share call would make it throw.
// On a private profile the images and link previews are never rendered for outsiders, so
// only the plain link is offered.
export default function SharePanel({
  handle,
  itemId,
  title,
  by,
  mine,
  friendsOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);

  const path = `/${handle}/${itemId}`;
  // The panel only renders after a click, so reading browser globals here can't cause a hydration mismatch.
  const onClient = open && typeof window !== "undefined";
  const url = `${onClient ? window.location.origin : "https://hoshigo.cc"}${path}`;
  const canShare = onClient && typeof navigator.share === "function";
  const text = `${mine ? "One of my five stars" : "Five stars"}: ${title}${by ? `, ${by}` : ""}.`;

  useEffect(() => {
    if (
      !open ||
      friendsOnly ||
      storyFile ||
      typeof navigator.canShare !== "function"
    )
      return;
    let cancelled = false;
    fetch(`${path}/card/story`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        const file = new File([blob], `hoshigo-${handle}.png`, {
          type: "image/png",
        });
        if (navigator.canShare({ files: [file] })) setStoryFile(file);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, friendsOnly, storyFile, path, handle]);

  async function shareImage() {
    if (!storyFile) return;
    try {
      await navigator.share({ files: [storyFile], text: `${text} ${url}` });
    } catch {}
  }

  async function shareLink() {
    try {
      await navigator.share({ title, text, url });
    } catch {}
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const enc = encodeURIComponent;
  const outlets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    {
      label: "X",
      href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`,
    },
    {
      label: "Bluesky",
      href: `https://bsky.app/intent/compose?text=${enc(`${text} ${url}`)}`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    },
    {
      label: "Email",
      href: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}`,
    },
  ];

  return (
    <div className="share">
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Share
      </button>
      {open && (
        <div className="share-panel">
          {canShare && (
            <div className="share-row">
              {storyFile && (
                <button type="button" className="btn" onClick={shareImage}>
                  Share image
                </button>
              )}
              <button type="button" className="btn" onClick={shareLink}>
                Share link
              </button>
            </div>
          )}
          <div className="share-row">
            <button type="button" className="btn" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <span className="link-dest">{url.replace(/^https?:\/\//, "")}</span>
          </div>
          {friendsOnly ? (
            <p className="meta">
              {mine
                ? "Your page is private, so this link"
                : "This page is private, so the link"}{" "}
              only opens for friends. Others will see just the name and bio.
            </p>
          ) : (
            <>
              <div className="share-label">Images to post</div>
              <div className="share-row">
                <a
                  className="share-link"
                  href={`${path}/card/story?download`}
                  download
                >
                  Story, 9:16
                </a>
                <a
                  className="share-link"
                  href={`${path}/card/portrait?download`}
                  download
                >
                  Feed, 4:5
                </a>
                <a
                  className="share-link"
                  href={`${path}/card/og?download`}
                  download
                >
                  Wide, 1200 × 630
                </a>
              </div>
              <div className="share-label">Send the link</div>
              <div className="share-row">
                {outlets.map((o) => (
                  <a
                    key={o.label}
                    className="share-link"
                    href={o.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {o.label}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
