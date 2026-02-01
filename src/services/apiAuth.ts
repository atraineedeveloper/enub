import supabase from "./supabase";
import type { User } from "@supabase/supabase-js";

interface LoginParams {
  email: string;
  password: string;
}

export async function login({ email, password }: LoginParams) {
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function getCurrentUser(): Promise<User | null> {
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

export async function updateCurrentUser({
  fullName,
  password,
  avatar,
}: {
  fullName?: string;
  password?: string;
  avatar?: File | null;
}) {
  // 1. Update password
  if (password) {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    return data;
  }

  // 2. Update full name or avatar
  const updates: Record<string, any> = {};
  if (fullName) updates.data = { fullName };

  if (avatar) {
    const fileName = `avatar-${Date.now()}`;
    const { error: storageError } = await supabase.storage
      .from("avatars")
      .upload(fileName, avatar);
    if (storageError) throw new Error(storageError.message);

    const { data: publicURL } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);
    updates.data = { ...updates.data, avatar: publicURL?.publicUrl };
  }

  const { data, error } = await supabase.auth.updateUser(updates);
  if (error) throw new Error(error.message);
  return data;
}
