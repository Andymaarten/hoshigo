"use client";

import { useEffect, useRef } from "react";

const CODE = "javascript:location.href='https://hoshigo.cc/add?url='+location.href";

// React refuses javascript: hrefs, so the bookmarklet's address is set on the element directly.
export default function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("href", CODE);
  }, []);
  return (
    <a ref={ref} className="btn bookmarklet" onClick={(e) => e.preventDefault()} title="Drag this to your bookmarks bar">
      Add to hoshigo
    </a>
  );
}
