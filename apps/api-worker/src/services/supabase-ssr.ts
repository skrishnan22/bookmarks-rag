import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context } from "hono";
import { getAuthCookieSettings } from "../auth/cookies.js";
import type { AppContext } from "../types.js";

export function createSupabaseServerClient(
  c: Context<AppContext>
): SupabaseClient {
  const cookieSettings = getAuthCookieSettings(c.env);

  return createServerClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    cookieOptions: cookieSettings,
    cookies: {
      getAll() {
        const cookieHeader = c.req.header("cookie");
        if (!cookieHeader) {
          return [];
        }

        return parseCookieHeader(cookieHeader).map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          c.header("Set-Cookie", serializeCookieHeader(name, value, options), {
            append: true,
          });
        }
      },
    },
  });
}
