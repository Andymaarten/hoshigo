import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Honest scope: this stops scripts that post straight to signup and naive bots.
// An agent that can really drag circles will pass; the signals below only raise
// the cost. Nothing leaves our server and nothing identifies the device.

const START_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const MIN_MS = 1500;

export type HumanSignals = {
  // how the five were placed: dragging, or the keyboard alternative
  mode: "pointer" | "keyboard";
  placed: number;
  moves: number;
  curved: number;
};

let devSecret: string | undefined;

function secret() {
  const own = process.env.HUMAN_CHECK_SECRET;
  if (own) return own;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!base) {
    if (process.env.NODE_ENV === "production") throw new Error("No HUMAN_CHECK_SECRET or SUPABASE_SERVICE_ROLE_KEY set");
    // local dev without keys: a per process secret is enough
    devSecret ??= randomBytes(32).toString("hex");
    return devSecret;
  }
  // derived, so the service key itself is never used as an HMAC key directly
  return createHash("sha256").update(`hoshigo-human-check:${base}`).digest("hex");
}

function sign(kind: string, body: string) {
  return createHmac("sha256", secret()).update(`${kind}.${body}`).digest("base64url");
}

function verify(kind: string, value: string): string[] | null {
  const parts = value.split(".");
  const sig = parts.pop();
  if (!sig || parts.length < 2) return null;
  const expected = Buffer.from(sign(kind, parts.join(".")));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return parts;
}

export function issueStart(): string {
  const body = `${Date.now()}.${randomBytes(9).toString("base64url")}`;
  return `${body}.${sign("start", body)}`;
}

// Returns a token for the signup form, or null when the attempt doesn't look human.
export function finish(start: string, s: HumanSignals): string | null {
  const parts = verify("start", start);
  if (!parts) return null;
  const elapsed = Date.now() - Number(parts[0]);
  if (!(elapsed >= MIN_MS && elapsed <= START_TTL_MS)) return null;
  if (s.placed !== 5) return null;
  if (s.mode === "pointer") {
    // five drags by hand produce dozens of move events and mostly bent paths
    if (s.moves < 25 || s.curved < 3) return null;
  } else if (elapsed < 2500) {
    return null;
  }
  const body = `${Date.now() + TOKEN_TTL_MS}.${parts[1]}`;
  return `${body}.${sign("human", body)}`;
}

export function isHumanToken(token: unknown): boolean {
  if (typeof token !== "string" || !token) return false;
  const parts = verify("human", token);
  return !!parts && Number(parts[0]) > Date.now();
}
