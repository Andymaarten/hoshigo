import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { INVITE_COOKIE } from "@/lib/friends";
import { TOKEN_RE } from "@/lib/post-login";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cookieStore = await cookies();
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!TOKEN_RE.test(token)) return to("/friends");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // remembered across signup, email confirmation and onboarding, then redeemed here again
    cookieStore.set(INVITE_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
    return to("/login?mode=signup&invite=1");
  }

  cookieStore.delete(INVITE_COOKIE);
  const { data: inviterHandle, error } = await supabase.rpc("accept_invite", { invite_token: token });
  if (error || typeof inviterHandle !== "string") return to("/friends");
  return to(`/${inviterHandle}`);
}
