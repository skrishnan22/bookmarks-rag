import { getCookie } from "hono/cookie";
import type { AppContext, AuthContext } from "../types.js";
import { CSRF_COOKIE_NAME } from "../auth/cookies.js";
import { createSupabaseServerClient } from "../services/supabase-ssr.js";
import type { MiddlewareHandler } from "hono";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
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

  if (!SAFE_METHODS.has(c.req.method)) {
    const csrfCookie = getCookie(c, CSRF_COOKIE_NAME);
    const csrfHeader = c.req.header("x-csrf-token");
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return c.json(
        {
          success: false,
          error: { code: "CSRF_INVALID", message: "CSRF token missing" },
        },
        403
      );
    }
  }

  c.set("auth", {
    userId: user.id,
    email: user.email ?? null,
  } satisfies AuthContext);

  return await next();
};
