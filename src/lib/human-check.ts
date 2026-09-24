import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Honest scope: this stops scripts that post straight to signup and naive bots.
// An agent that can really drag circles will pass; the signals below only raise
// the cost. Nothing leaves our server and nothing identifies the device.
// A real person is never locked out: the second try is relaxed and the third
// passes with a review flag.

const START_TTL_MS = 30 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;

export type HumanSignals = {
  mode: "pointer" | "touch" | "keyboard";
  placed: number;
  moves: number;
  curved: number;
  attempt: number;
};

export type HumanResult = { token: string; review: boolean } | { token: null; reason: string };

let devSecret: string | undefined;
let warned = false;

function secret(): string | null {
  const own = process.env.HUMAN_CHECK_SECRET;
  if (own) return own;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (base) return createHash("sha256").update(`hoshigo-human-check:${base}`).digest("hex");
  if (process.env.NODE_ENV !== "production") {
    devSecret ??= randomBytes(32).toString("hex");
    return devSecret;
  }
  if (!warned) {
    console.error("[human-check] no HUMAN_CHECK_SECRET or SUPABASE_SERVICE_ROLE_KEY; failing open");
    warned = true;
  }
  return null;
}

function sign(key: string, kind: string, body: string) {
  return createHmac("sha256", key).update(`${kind}.${body}`).digest("base64url");
}

function verify(key: string, kind: string, value: string): string[] | null {
  const parts = value.split(".");
  const sig = parts.pop();
  if (!sig || parts.length < 2) return null;
  const expected = Buffer.from(sign(key, kind, parts.join(".")));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return parts;
}

export function issueStart(): string {
  const key = secret();
  const body = `${Date.now()}.${randomBytes(9).toString("base64url")}`;
  return key ? `${body}.${sign(key, "start", body)}` : `${body}.open`;
}

function reject(s: HumanSignals, elapsed: number): string | null {
  if (s.placed !== 5) return "not_all_placed";
  // second try is relaxed: only the most mechanical runs are turned away
  const relaxed = s.attempt >= 2;
  const minMs = s.mode === "keyboard" ? 2500 : relaxed ? 800 : 1500;
  if (elapsed < minMs) return "too_fast";
  if (s.mode === "keyboard") return null;
  // iOS coalesces touch moves, so a finger drag can report only a few events
  const minMoves = s.mode === "touch" || relaxed ? 5 : 20;
  if (s.moves < minMoves) return "too_few_moves";
  if (s.mode === "pointer" && !relaxed && s.curved < 2) return "straight_paths";
  return null;
}

export function finish(start: string, s: HumanSignals): HumanResult {
  const key = secret();
  if (!key) {
    console.info("[human-check] pass reason=no_secret");
    return { token: "open", review: false };
  }
  const parts = verify(key, "start", start);
  if (!parts) {
    console.info("[human-check] fail reason=bad_start");
    return { token: null, reason: "bad_start" };
  }
  const elapsed = Date.now() - Number(parts[0]);
  if (elapsed > START_TTL_MS) {
    console.info("[human-check] fail reason=expired");
    return { token: null, reason: "expired" };
  }
  let reason = reject(s, elapsed);
  let review = false;
  if (reason && s.attempt >= 3) {
    review = true;
    reason = null;
  }
  const log = `mode=${s.mode} attempt=${s.attempt} ms=${elapsed} moves=${s.moves} curved=${s.curved}`;
  if (reason) {
    console.info(`[human-check] fail reason=${reason} ${log}`);
    return { token: null, reason };
  }
  console.info(`[human-check] pass${review ? " review" : ""} ${log}`);
  const body = `${Date.now() + TOKEN_TTL_MS}.${review ? "r" : "h"}`;
  return { token: `${body}.${sign(key, "human", body)}`, review };
}

// ok: may sign up. review: passed only through the fallback, worth a look.
export function checkHumanToken(token: unknown): { ok: boolean; review: boolean } {
  const key = secret();
  if (!key) return { ok: true, review: false };
  if (typeof token !== "string" || !token) return { ok: false, review: false };
  const parts = verify(key, "human", token);
  if (!parts || Number(parts[0]) <= Date.now()) return { ok: false, review: false };
  return { ok: true, review: parts[1] === "r" };
}
