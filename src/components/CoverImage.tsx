"use client";

import { useState } from "react";
import { imageSrc } from "@/lib/image-src";

// Every cover and photo goes through here: right sized source, no referrer (several
// image hosts block hotlinks based on it), lazy decoding, and it removes itself when the
// image fails so a broken icon never shows. The parent's block color stays as fallback.
export default function CoverImage({
  src,
  alt = "",
  className,
  style,
  eager,
  onFail,
  rejectOdd,
  small,
}: {
  rejectOdd?: boolean;
  small?: boolean;
  src: string | null | undefined;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
  onFail?: () => void;
}) {
  const resolved = imageSrc(src, small ? "small" : "normal");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!resolved || failedSrc === resolved) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={className}
      style={style}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailedSrc(resolved);
        onFail?.();
      }}
      onLoad={(e) => {
        if (!rejectOdd) return;
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
        // Scraped pages are full of spacer gifs and nav strips; those aren't photos.
        if (w < 80 || h < 80 || w / h > 3 || h / w > 3) {
          setFailedSrc(resolved);
          onFail?.();
        }
      }}
    />
  );
}
