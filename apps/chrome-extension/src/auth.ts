import { createClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      async getItem(key: string) {
        const result = await chrome.storage.local.get(key);
        return result[key] ?? null;
      },
      async setItem(key: string, value: string) {
        await chrome.storage.local.set({ [key]: value });
      },
      async removeItem(key: string) {
        await chrome.storage.local.remove(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
}

export async function getAuthState(): Promise<AuthState> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    isAuthenticated: !!session?.user,
    user: session?.user ?? null,
    accessToken: session?.access_token ?? null,
  };
}

export async function signInWithGoogle(): Promise<AuthState> {
  const redirectUrl = chrome.identity.getRedirectURL('supabase-auth');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    throw new Error(error?.message ?? 'Failed to get OAuth URL');
  }

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error('Auth flow was cancelled');
  }

  const hashParams = new URLSearchParams(responseUrl.split('#')[1] ?? '');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (!accessToken || !refreshToken) {
    const errorDesc = hashParams.get('error_description') || hashParams.get('error');
    throw new Error(errorDesc ?? 'No tokens in response');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.session) {
    throw new Error(sessionError?.message ?? 'Failed to set session');
  }

  return {
    isAuthenticated: true,
    user: sessionData.session.user,
    accessToken: sessionData.session.access_token,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
