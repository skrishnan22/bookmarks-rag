import { getCookie } from "hono/cookie";
import { createClient } from "@supabase/supabase-js";
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

  // Try Bearer token auth first (for extension/API clients)
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const user = await validateBearerToken(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_ANON_KEY,
      token
    );

    if (user) {
      c.set("auth", {
        userId: user.id,
        email: user.email ?? null,
      } satisfies AuthContext);
      return await next();
    }

    return c.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid token" },
      },
      401
    );
  }

  // Fall back to cookie-based auth (for web app)
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

  // CSRF check only for cookie-based auth on non-safe methods
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

async function validateBearerToken(
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string
): Promise<{ id: string; email?: string } | null> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user.email ? { id: user.id, email: user.email } : { id: user.id };
}
