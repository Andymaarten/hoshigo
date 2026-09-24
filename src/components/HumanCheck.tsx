"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { finishHumanCheck, startHumanCheck } from "@/app/login/actions";

const COUNT = 5;
// Slot tilt and circle scatter, fixed so every visit looks the same hand made tray.
const SLOT_TILT = [-3, 2, -1, 3, -2];
const PILE = [
  { dx: -6, dy: 10, r: -8 },
  { dx: 4, dy: -6, r: 6 },
  { dx: -2, dy: 14, r: -3 },
  { dx: 8, dy: -2, r: 9 },
  { dx: -4, dy: 6, r: -5 },
];

type Offset = { x: number; y: number };

const pileOffsets = () => PILE.map((p) => ({ x: p.dx, y: p.dy }));

export default function HumanCheck({ onDone, onCancel }: { onDone: (token: string) => void; onCancel: () => void }) {
  const [start, setStart] = useState<string | null>(null);
  const [slotOf, setSlotOf] = useState<(number | null)[]>(() => Array(COUNT).fill(null));
  const [offsets, setOffsets] = useState<Offset[]>(pileOffsets);
  const [dragging, setDragging] = useState<number | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const [status, setStatus] = useState<"playing" | "checking" | "done" | "retry" | "offline">("playing");
  const [attempt, setAttempt] = useState(1);

  const slotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const circleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef<{ i: number; px: number; py: number; base: Offset; path: Offset[]; id: number } | null>(null);
  const signals = useRef({ moves: 0, curved: 0, keyboard: false, touch: false });

  useEffect(() => {
    startHumanCheck()
      .then(setStart)
      .catch(() => setStart(null));
    circleRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Where a circle's resting (home) centre is. Uses the offset that is actually
  // painted, since the latest pointer move may not have rendered yet.
  const homeCentre = useCallback((i: number) => {
    const el = circleRefs.current[i]!;
    const r = el.getBoundingClientRect();
    const x = parseFloat(el.style.getPropertyValue("--x")) || 0;
    const y = parseFloat(el.style.getPropertyValue("--y")) || 0;
    return { x: r.left + r.width / 2 - x, y: r.top + r.height / 2 - y };
  }, []);

  const slotCentre = (s: number) => {
    const r = slotRefs.current[s]!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 };
  };

  // Keep placed circles in their slots when the layout shifts (rotation, resize).
  const realign = useCallback(() => {
    setOffsets((prev) =>
      prev.map((o, i) => {
        const s = slotOf[i];
        if (s === null || !circleRefs.current[i]) return o;
        const home = homeCentre(i);
        const c = slotCentre(s);
        return { x: c.x - home.x, y: c.y - home.y };
      })
    );
  }, [slotOf, homeCentre]);

  useLayoutEffect(() => {
    window.addEventListener("resize", realign);
    return () => window.removeEventListener("resize", realign);
  }, [realign]);

  const place = (i: number, s: number) => {
    const home = homeCentre(i);
    const c = slotCentre(s);
    const nextSlots = slotOf.slice();
    nextSlots[i] = s;
    setSlotOf(nextSlots);
    setOffsets((prev) => prev.map((o, j) => (j === i ? { x: c.x - home.x, y: c.y - home.y } : o)));
    setLanded(s);
    window.setTimeout(() => setLanded((v) => (v === s ? null : v)), 700);
    if (nextSlots.every((v) => v !== null)) complete();
  };

  const freeSlots = () => [...Array(COUNT).keys()].filter((s) => !slotOf.includes(s));

  // Every outcome ends in a visible state; nothing here may leave the tray hanging.
  const complete = async () => {
    setStatus("checking");
    try {
      const s = start ?? (await startHumanCheck());
      const result = await finishHumanCheck(s, {
        mode: signals.current.keyboard ? "keyboard" : signals.current.touch ? "touch" : "pointer",
        placed: COUNT,
        moves: signals.current.moves,
        curved: signals.current.curved,
        attempt,
      });
      if (result.token) {
        setStatus("done");
        const token = result.token;
        window.setTimeout(() => onDone(token), 1600);
      } else {
        setStatus("retry");
      }
    } catch {
      setStatus("offline");
    }
  };

  const reset = async () => {
    signals.current = { moves: 0, curved: 0, keyboard: false, touch: false };
    setAttempt((a) => a + 1);
    setSlotOf(Array(COUNT).fill(null));
    setOffsets(pileOffsets());
    setDragging(null);
    drag.current = null;
    setStatus("playing");
    try {
      setStart(await startHumanCheck());
    } catch {
      setStart(null);
    }
  };

  const onPointerDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (slotOf[i] !== null || status !== "playing" || drag.current) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") signals.current.touch = true;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture can fail for a pointer that already ended; the drag still works without it
    }
    drag.current = { i, px: e.clientX, py: e.clientY, base: offsets[i], path: [{ x: e.clientX, y: e.clientY }], id: e.pointerId };
    setDragging(i);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // iOS batches touch moves; count the ones folded into this event too
    signals.current.moves += e.nativeEvent.getCoalescedEvents?.().length || 1;
    d.path.push({ x: e.clientX, y: e.clientY });
    setOffsets((prev) => prev.map((o, j) => (j === d.i ? { x: d.base.x + e.clientX - d.px, y: d.base.y + e.clientY - d.py } : o)));
  };

  const release = (i: number) => setOffsets((prev) => prev.map((o, j) => (j === i ? pileOffsets()[j] : o)));

  // Cancelled or lost drags float home instead of staying stuck mid air.
  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(null);
    release(d.i);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(null);
    if (bends(d.path)) signals.current.curved++;

    const current = { x: d.base.x + e.clientX - d.px, y: d.base.y + e.clientY - d.py };
    const home = homeCentre(d.i);
    const at = { x: home.x + current.x, y: home.y + current.y };
    let best: number | null = null;
    let bestDist = Infinity;
    for (const s of freeSlots()) {
      const c = slotCentre(s);
      const dist = Math.hypot(c.x - at.x, c.y - at.y);
      // generous: anywhere over the slot or just off its rim counts
      if (dist < c.radius * 1.6 && dist < bestDist) {
        best = s;
        bestDist = dist;
      }
    }
    if (best !== null) place(d.i, best);
    else release(d.i);
  };

  // Keyboard and screen reader route: Enter or Space drops it in the next free slot.
  const onClick = (i: number) => (e: React.MouseEvent) => {
    if (e.detail !== 0 || slotOf[i] !== null || status !== "playing") return;
    signals.current.keyboard = true;
    const s = freeSlots()[0];
    if (s !== undefined) place(i, s);
    const next = circleRefs.current.findIndex((_, j) => j !== i && slotOf[j] === null);
    if (next >= 0) circleRefs.current[next]?.focus();
  };

  const placedCount = slotOf.filter((v) => v !== null).length;

  return (
    <div className="hc-backdrop">
      <div className="hc" role="dialog" aria-modal="true" aria-labelledby="hc-title" aria-describedby="hc-help">
        <p id="hc-title" className="hc-title">
          {status === "done"
            ? "You've just proven you're human, not a bot. Welcome!"
            : "Your hoshigo holds only what you'd give five stars. Put the five in their place."}
        </p>
        <p id="hc-help" className="sr-only">
          Drag each red circle into an empty slot, or focus a circle and press Enter to place it.
        </p>

        <div className={`hc-tray${status === "done" ? " hc-tray-done" : ""}`}>
          {SLOT_TILT.map((tilt, s) => (
            <span
              key={s}
              ref={(el) => {
                slotRefs.current[s] = el;
              }}
              className={`hc-slot${landed === s ? " hc-slot-warm" : ""}`}
              style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="hc-pile">
          {PILE.map((p, i) => (
            <button
              key={i}
              type="button"
              ref={(el) => {
                circleRefs.current[i] = el;
              }}
              className={`hc-circle${dragging === i ? " hc-dragging" : ""}${slotOf[i] !== null ? " hc-placed" : ""}${
                slotOf[i] !== null && landed === slotOf[i] ? " hc-landed" : ""
              }`}
              style={
                {
                  "--x": `${offsets[i].x}px`,
                  "--y": `${offsets[i].y}px`,
                  "--rot": `${slotOf[i] === null ? p.r : 0}deg`,
                } as React.CSSProperties
              }
              aria-label={slotOf[i] === null ? `Hoshigo ${i + 1}, not placed yet` : `Hoshigo ${i + 1}, placed`}
              aria-disabled={slotOf[i] !== null}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onLostPointerCapture={onPointerCancel}
              onClick={onClick(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/hero/redhoshigos_${i + 1}.png`} alt="" width={300} height={310} draggable={false} />
            </button>
          ))}
        </div>

        <p className="hc-foot" aria-live="polite">
          {status === "retry" || status === "offline" ? (
            <>
              {status === "offline"
                ? "We couldn't reach hoshigo just now."
                : "That went a little quick for us to be sure."}{" "}
              <button type="button" className="link-btn" onClick={reset}>
                Try again
              </button>
            </>
          ) : status === "checking" ? (
            "Checking…"
          ) : status === "done" ? (
            "One moment…"
          ) : (
            `${placedCount} of 5 in place`
          )}
        </p>
        {status !== "done" && (
          <button type="button" className="link-btn hc-cancel" onClick={onCancel}>
            Not now
          </button>
        )}
      </div>
    </div>
  );
}

// A hand drawn drag wanders; a scripted one runs dead straight.
function bends(path: Offset[]) {
  if (path.length < 4) return false;
  const a = path[0];
  const b = path[path.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let max = 0;
  for (const p of path) {
    const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
    if (d > max) max = d;
  }
  return max > 3;
}
