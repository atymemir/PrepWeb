import { createClient } from "@supabase/supabase-js";

export async function getUserFromAccessToken(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Missing bearer token." };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { user: null, error: "Empty bearer token." };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: error?.message || "Unauthorized." };
  }

  return { user: data.user, token, error: null };
}
