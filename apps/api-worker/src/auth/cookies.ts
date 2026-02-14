import type { Env } from "../types.js";

export const CSRF_COOKIE_NAME = "csrf_token";

export type AuthCookieSameSite = "lax" | "strict" | "none";

export interface AuthCookieSettings {
  domain?: string;
  path: "/";
  sameSite: AuthCookieSameSite;
  secure: boolean;
}

export function getAuthCookieSettings(
  env: Pick<Env, "ENVIRONMENT" | "AUTH_COOKIE_DOMAIN">
): AuthCookieSettings {
  const domain = normalizeCookieDomain(env.AUTH_COOKIE_DOMAIN);

  return {
    path: "/",
    sameSite: "lax",
    secure: env.ENVIRONMENT === "production",
    ...(domain ? { domain } : {}),
  };
}

export function toHonoSameSite(
  value: AuthCookieSameSite
): "Lax" | "Strict" | "None" {
  if (value === "strict") {
    return "Strict";
  }

  if (value === "none") {
    return "None";
  }

  return "Lax";
}

function normalizeCookieDomain(domain: string | undefined): string | undefined {
  if (!domain) {
    return undefined;
  }

  const trimmed = domain.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
