// Simple drawn device icons in ink; generic shapes rather than brand marks.
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function PhoneIcon() {
  return (
    <svg viewBox="0 0 32 32">
      <rect x="9" y="3" width="14" height="26" rx="3" {...stroke} />
      <path d="M14 6.5h4" {...stroke} />
      <circle cx="16" cy="25.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function AndroidIcon() {
  return (
    <svg viewBox="0 0 32 32">
      <path d="M8 14a8 7 0 0 1 16 0z" {...stroke} />
      <path d="M8 16h16v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" {...stroke} />
      <path d="M11 6.5l2 3M21 6.5l-2 3M5 16.5v6M27 16.5v6M13 26v3M19 26v3" {...stroke} />
      <circle cx="12.8" cy="11.8" r="0.9" fill="currentColor" />
      <circle cx="19.2" cy="11.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function LaptopIcon() {
  return (
    <svg viewBox="0 0 32 32">
      <rect x="6" y="7" width="20" height="14" rx="1.5" {...stroke} />
      <path d="M3 25h26" {...stroke} />
    </svg>
  );
}
