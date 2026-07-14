import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import supabase from "./supabase";

interface LoginCredentials {
  email: string;
  password: string;
}

export async function login({ email, password }: LoginCredentials) {
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function getCurrentUser() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data, error } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  return data?.user;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function updateUserPassword({ password }: { password: string }) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export type PasswordRecoveryOutcome = "submitted" | "retry_later";

// Fail-closed classification: only a transport failure -- the browser is
// offline, a network/DNS/connection error, or the request never reached
// the Supabase Auth API at all -- is safe to show as a distinct state,
// since that happens identically no matter which email was submitted.
// `isAuthRetryableFetchError` is the SDK's own stable marker for exactly
// this case (fetch-level failure or a 502/503/504 before any per-account
// response body was ever read); it never fires for a real Auth API
// response. Any actual response from the Auth API -- an `AuthApiError`,
// whether a known code (e.g. the email-send/rate-limit codes, which
// GoTrue only ever applies to a registered address) or an unrecognized
// future code -- intentionally falls through to the same neutral
// "submitted" outcome below. We deliberately do not enumerate or match on
// specific error codes/messages here: an unknown or newly introduced
// Auth API error could just as easily correlate with account existence,
// so the safe default is to treat every Auth API response as
// indistinguishable from success rather than risk a new enumeration gap.
export async function requestPasswordRecovery(
  email: string,
): Promise<PasswordRecoveryOutcome> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/set-password`,
  });

  if (error && isAuthRetryableFetchError(error)) return "retry_later";
  return "submitted";
}
