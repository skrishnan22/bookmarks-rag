import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { toUpsertPayload } from "./supabase-user.js";

describe("toUpsertPayload", () => {
  it("returns null when user has no email", () => {
    const user = {
      id: "9f04fab6-4914-4d95-b04d-368ce45d019a",
      email: null,
      user_metadata: {},
      identities: [],
    } as unknown as User;

    expect(toUpsertPayload(user)).toBeNull();
  });

  it("maps and trims metadata values", () => {
    const user = {
      id: "b28fcc57-ea45-45ca-a073-ddf5ec0343a1",
      email: "ada@example.com",
      user_metadata: {
        full_name: "  Ada Lovelace ",
        avatar_url: " https://example.com/ada.png ",
        provider_id: " google-provider-id ",
      },
      identities: [],
    } as unknown as User;

    expect(toUpsertPayload(user)).toEqual({
      id: "b28fcc57-ea45-45ca-a073-ddf5ec0343a1",
      email: "ada@example.com",
      googleId: "google-provider-id",
      name: "Ada Lovelace",
      avatarUrl: "https://example.com/ada.png",
    });
  });

  it("uses google identity id when provider_id is missing", () => {
    const user = {
      id: "fd756f8d-ed56-4677-a2aa-eb105f4b8c4b",
      email: "grace@example.com",
      user_metadata: {
        name: "Grace Hopper",
      },
      identities: [
        {
          provider: "google",
          id: "google-identity-id",
        },
      ],
    } as unknown as User;

    expect(toUpsertPayload(user)?.googleId).toBe("google-identity-id");
  });

  it("uses google identity sub when identity id is missing", () => {
    const user = {
      id: "80309e9e-643b-445f-b2a2-b3b14201295a",
      email: "katherine@example.com",
      user_metadata: {
        name: "Katherine Johnson",
      },
      identities: [
        {
          provider: "google",
          identity_data: {
            sub: "  google-sub-id  ",
          },
        },
      ],
    } as unknown as User;

    expect(toUpsertPayload(user)?.googleId).toBe("google-sub-id");
  });

  it("falls back to user id when metadata is malformed", () => {
    const user = {
      id: "0fd26f5e-9f2c-4991-bb61-e154437324dd",
      email: "linus@example.com",
      user_metadata: "unexpected-string",
      identities: "unexpected-string",
    } as unknown as User;

    expect(toUpsertPayload(user)).toEqual({
      id: "0fd26f5e-9f2c-4991-bb61-e154437324dd",
      email: "linus@example.com",
      googleId: "0fd26f5e-9f2c-4991-bb61-e154437324dd",
      name: null,
      avatarUrl: null,
    });
  });
});
