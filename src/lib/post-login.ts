import { cookies } from "next/headers";
import { INVITE_COOKIE } from "@/lib/friends";

const TOKEN_RE = /^[a-f0-9]{32}$/;

/** A pending invite (set when a logged-out visitor opened an invite link) wins over everything. */
export async function pendingInvitePath(): Promise<string | null> {
  const token = (await cookies()).get(INVITE_COOKIE)?.value;
  return token && TOKEN_RE.test(token) ? `/invite/${token}` : null;
}

/** Only same-site paths, so ?next= can't bounce people to another domain. */
export function safeNextPath(raw: FormDataEntryValue | null): string | null {
  const next = typeof raw === "string" ? raw : "";
  return /^\/[a-z0-9_-]{1,40}$/i.test(next) ? next : null;
}

export { TOKEN_RE };
