import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createDb, UserRepository } from "@rag-bookmarks/shared";
import {
  CSRF_COOKIE_NAME,
  getAuthCookieSettings,
  toHonoSameSite,
} from "../auth/cookies.js";
import { toUpsertPayload } from "../auth/supabase-user.js";
import { createSupabaseServerClient } from "../services/supabase-ssr.js";
import type { AppContext } from "../types.js";

const authRouter = new Hono<AppContext>();

authRouter.get("/login/google", async (c) => {
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_ANON_KEY) {
    return c.redirect("/?error=auth_not_configured");
  }

  if (!c.env.WEB_ORIGIN) {
    return c.redirect("/?error=web_origin_not_configured");
  }

  const supabase = createSupabaseServerClient(c);
  const redirectTo = `${c.env.WEB_ORIGIN}/api/v1/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "email profile",
    },
  });

  if (error || !data.url) {
    console.error("OAuth sign in error:", error);
    return c.redirect("/?error=oauth_failed");
  }

  return c.redirect(data.url);
});

authRouter.get("/callback", async (c) => {
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_ANON_KEY) {
    return c.redirect("/?error=auth_not_configured");
  }

  const code = c.req.query("code");
  if (!code) {
    return c.redirect("/?error=missing_code");
  }

  const supabase = createSupabaseServerClient(c);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth callback error:", error);
    return c.redirect("/?error=callback_failed");
  }

  return c.redirect("/");
});

authRouter.get("/me", async (c) => {
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_ANON_KEY) {
    return c.json(
      {
        success: false,
        error: {
          code: "AUTH_CONFIG_ERROR",
          message: "Supabase auth is not configured",
        },
      },
      500
    );
  }

  const supabase = createSupabaseServerClient(c);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      },
      401
    );
  }

  const upsertPayload = toUpsertPayload(user);
  if (!upsertPayload) {
    return c.json(
      {
        success: false,
        error: { code: "EMAIL_REQUIRED", message: "Email is required" },
      },
      400
    );
  }

  const { db } = createDb(c.env.DATABASE_URL);
  const userRepo = new UserRepository(db);

  await userRepo.upsert(upsertPayload);
  ensureCsrfToken(c);

  return c.json({
    success: true,
    data: {
      user: {
        id: upsertPayload.id,
        email: upsertPayload.email,
        name: upsertPayload.name ?? null,
        avatarUrl: upsertPayload.avatarUrl ?? null,
      },
    },
  });
});

authRouter.post("/logout", async (c) => {
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_ANON_KEY) {
    return c.json(
      {
        success: false,
        error: {
          code: "AUTH_CONFIG_ERROR",
          message: "Supabase auth is not configured",
        },
      },
      500
    );
  }

  const supabase = createSupabaseServerClient(c);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    console.warn("Failed to sign out Supabase session", error);
  }

  const cookieSettings = getAuthCookieSettings(c.env);
  const deleteOptions = {
    path: cookieSettings.path,
    ...(cookieSettings.domain ? { domain: cookieSettings.domain } : {}),
  };

  clearSupabaseAuthCookies(c, deleteOptions);
  deleteCookie(c, CSRF_COOKIE_NAME, deleteOptions);

  return c.json({ success: true });
});

function ensureCsrfToken(c: Context<AppContext>): string {
  const existingToken = getCookie(c, CSRF_COOKIE_NAME);
  if (existingToken) {
    return existingToken;
  }

  const cookieSettings = getAuthCookieSettings(c.env);
  const csrfToken = crypto.randomUUID();

  setCookie(c, CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: cookieSettings.secure,
    sameSite: toHonoSameSite(cookieSettings.sameSite),
    path: cookieSettings.path,
    ...(cookieSettings.domain ? { domain: cookieSettings.domain } : {}),
  });

  return csrfToken;
}

function clearSupabaseAuthCookies(
  c: Context<AppContext>,
  deleteOptions: { path: string; domain?: string }
): void {
  const cookies = getCookie(c);
  for (const cookieName of Object.keys(cookies)) {
    if (cookieName.startsWith("sb-") && cookieName.includes("-auth-token")) {
      deleteCookie(c, cookieName, deleteOptions);
    }
  }
}

export { authRouter };
