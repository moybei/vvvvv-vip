import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/auth-error"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Signed in with a Google account outside the allowed domain: this is the
  // server-side backstop behind the Google Workspace "Internal" OAuth
  // consent screen restriction — reject explicitly instead of looping.
  if (!error && email && !isAllowedEmail(email)) {
    if (path === "/auth/auth-error") return response;
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/auth/auth-error";
    return NextResponse.redirect(url);
  }

  const isAuthed = !error && !!email;

  if (!isAuthed && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isAuthed && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
