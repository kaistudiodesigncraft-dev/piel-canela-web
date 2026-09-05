import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const config = getSupabasePublicConfig();
  if (!config) {
    const isProtectedAdminRoute = request.nextUrl.pathname.startsWith("/admin")
      && !request.nextUrl.pathname.startsWith("/admin/login");
    if (isProtectedAdminRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*"],
};
