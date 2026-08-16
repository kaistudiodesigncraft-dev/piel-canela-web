import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>(["invite", "recovery"]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.search = "";

  if (tokenHash && type && allowedTypes.has(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      redirectUrl.pathname = "/auth/set-password";
      return NextResponse.redirect(redirectUrl);
    }
  }

  redirectUrl.pathname = "/admin/login";
  redirectUrl.searchParams.set("error", "invite");
  return NextResponse.redirect(redirectUrl);
}
