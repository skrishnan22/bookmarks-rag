import type { User } from "@supabase/supabase-js";
import { z } from "zod";

const nonEmptyTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1));

const userMetadataSchema = z
  .object({
    full_name: nonEmptyTrimmedString.optional(),
    name: nonEmptyTrimmedString.optional(),
    avatar_url: nonEmptyTrimmedString.optional(),
    picture: nonEmptyTrimmedString.optional(),
    provider_id: nonEmptyTrimmedString.optional(),
  })
  .passthrough();

const identityDataSchema = z
  .object({
    sub: nonEmptyTrimmedString.optional(),
  })
  .passthrough();

const identitySchema = z
  .object({
    provider: z.string().optional(),
    id: nonEmptyTrimmedString.optional(),
    identity_data: z.unknown().optional(),
  })
  .passthrough();

const identitiesSchema = z.array(identitySchema);

type ParsedIdentity = z.infer<typeof identitySchema>;

export interface SupabaseUserUpsertPayload {
  id: string;
  email: string;
  googleId: string;
  name: string | null;
  avatarUrl: string | null;
}

export function toUpsertPayload(user: User): SupabaseUserUpsertPayload | null {
  if (!user.email) {
    return null;
  }

  const metadataResult = userMetadataSchema.safeParse(user.user_metadata);
  const userMetadata = metadataResult.success ? metadataResult.data : {};

  const identitiesResult = identitiesSchema.safeParse(user.identities);
  const identities = identitiesResult.success ? identitiesResult.data : [];

  const name = userMetadata.full_name ?? userMetadata.name ?? null;
  const avatarUrl = userMetadata.avatar_url ?? userMetadata.picture ?? null;

  return {
    id: user.id,
    email: user.email,
    googleId: extractGoogleId(user.id, userMetadata.provider_id, identities),
    name,
    avatarUrl,
  };
}

function extractGoogleId(
  fallbackUserId: string,
  metadataProviderId: string | undefined,
  identities: ParsedIdentity[]
): string {
  if (metadataProviderId) {
    return metadataProviderId;
  }

  for (const identity of identities) {
    if (identity.provider !== "google") {
      continue;
    }

    if (identity.id) {
      return identity.id;
    }

    const identityDataResult = identityDataSchema.safeParse(
      identity.identity_data
    );
    if (identityDataResult.success && identityDataResult.data.sub) {
      return identityDataResult.data.sub;
    }
  }

  return fallbackUserId;
}
