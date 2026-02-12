import { Hono } from "hono";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContext, Env } from "../types.js";
import { authRouter } from "./auth.js";

const getUserMock = vi.fn();
const signOutMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("@rag-bookmarks/shared", () => ({
  createDb: vi.fn(() => ({ db: {} })),
  UserRepository: vi.fn().mockImplementation(() => ({
    upsert: upsertMock,
  })),
}));

vi.mock("../services/supabase-ssr.js", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      signOut: signOutMock,
    },
  })),
}));

describe("auth routes", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    signOutMock.mockReset();
    upsertMock.mockReset();
  });

  it("returns 401 when session is missing", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("unauthorized"),
    });

    const response = await requestAuthRoute("/me");
    const payload = (await response.json()) as {
      success: boolean;
      error?: { code: string };
    };

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("returns current user and sets csrf cookie", async () => {
    const supabaseUser = {
      id: "f37d43c5-cf81-448b-953d-060fcf5e9f42",
      email: "ada@example.com",
      user_metadata: {
        full_name: "Ada Lovelace",
        avatar_url: "https://example.com/ada.png",
        provider_id: "google-oauth-ada",
      },
      identities: [],
    } as unknown as User;

    getUserMock.mockResolvedValue({
      data: { user: supabaseUser },
      error: null,
    });
    upsertMock.mockResolvedValue(undefined);

    const response = await requestAuthRoute("/me");
    const payload = (await response.json()) as {
      success: boolean;
      data: {
        user: {
          id: string;
          email: string;
          name: string | null;
          avatarUrl: string | null;
        };
      };
    };
    const setCookieHeaders = getSetCookieHeaders(response.headers);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.user).toEqual({
      id: "f37d43c5-cf81-448b-953d-060fcf5e9f42",
      email: "ada@example.com",
      name: "Ada Lovelace",
      avatarUrl: "https://example.com/ada.png",
    });
    expect(upsertMock).toHaveBeenCalledWith({
      id: "f37d43c5-cf81-448b-953d-060fcf5e9f42",
      email: "ada@example.com",
      googleId: "google-oauth-ada",
      name: "Ada Lovelace",
      avatarUrl: "https://example.com/ada.png",
    });
    expect(
      setCookieHeaders.some((header) => header.includes("csrf_token="))
    ).toBe(true);
  });

  it("returns 400 when provider user has no email", async () => {
    const supabaseUser = {
      id: "7f5f9d66-f9cb-4e4e-ac22-a8e6c593f5bf",
      email: null,
      user_metadata: {},
      identities: [],
    } as unknown as User;

    getUserMock.mockResolvedValue({
      data: { user: supabaseUser },
      error: null,
    });

    const response = await requestAuthRoute("/me");
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("EMAIL_REQUIRED");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("clears supabase and csrf cookies on logout", async () => {
    signOutMock.mockResolvedValue({ error: null });

    const response = await requestAuthRoute("/logout", {
      method: "POST",
      headers: {
        cookie:
          "csrf_token=csrf123; sb-project-auth-token=abc; sb-project-auth-token.0=def",
      },
    });
    const payload = (await response.json()) as { success: boolean };
    const setCookieHeaders = getSetCookieHeaders(response.headers);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(
      setCookieHeaders.some((header) =>
        header.startsWith("sb-project-auth-token=;")
      )
    ).toBe(true);
    expect(
      setCookieHeaders.some((header) =>
        header.startsWith("sb-project-auth-token.0=;")
      )
    ).toBe(true);
    expect(
      setCookieHeaders.some((header) => header.startsWith("csrf_token=;"))
    ).toBe(true);
  });

  it("returns success on logout even when supabase sign-out fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    signOutMock.mockResolvedValue({ error: new Error("network") });

    const response = await requestAuthRoute("/logout", {
      method: "POST",
      headers: { cookie: "csrf_token=csrf123" },
    });
    const payload = (await response.json()) as { success: boolean };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    warnSpy.mockRestore();
  });
});

function createTestApp() {
  const app = new Hono<AppContext>();
  app.route("/api/v1/auth", authRouter);
  return app;
}

function createTestEnv(): Env {
  return {
    ENVIRONMENT: "development",
    DATABASE_URL: "postgresql://db.example.dev/postgres",
    OPENROUTER_API_KEY: "test-openrouter",
    JINA_API_KEY: "test-jina",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    TMDB_API_KEY: "test-tmdb",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    WEB_ORIGIN: "http://localhost:3000",
    INGESTION_QUEUE: {} as Env["INGESTION_QUEUE"],
  };
}

function requestAuthRoute(path: string, init?: RequestInit) {
  const app = createTestApp();
  return app.request(
    `http://localhost/api/v1/auth${path}`,
    init,
    createTestEnv()
  );
}

function getSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  const setCookieHeaders = withGetSetCookie.getSetCookie?.();
  if (setCookieHeaders && setCookieHeaders.length > 0) {
    return setCookieHeaders;
  }

  const fallback = headers.get("set-cookie");
  return fallback ? [fallback] : [];
}
