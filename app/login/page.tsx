'use client';
export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setMsg(null);
    setLoading(true);
    try {
      const supabase = getSupabase(); // ✅ only inside handler
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }
      router.push("/today");
    } catch (e: any) {
      setMsg(e?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function signUp() {
    setMsg(null);
    setLoading(true);
    try {
      const supabase = getSupabase(); // ✅ only inside handler
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Account created. Now sign in.");
    } catch (e: any) {
      setMsg(e?.message || "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-gray-600 mt-1">Email + password</p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-lg border p-3"
            placeholder="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="w-full rounded-lg border p-3"
            placeholder="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {msg && <div className="mt-4 text-sm text-red-600">{msg}</div>}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={signIn}
            disabled={loading}
            className="rounded-lg bg-black text-white py-3 font-medium disabled:opacity-60"
          >
            Sign in
          </button>
          <button
            onClick={signUp}
            disabled={loading}
            className="rounded-lg border py-3 font-medium disabled:opacity-60"
          >
            Sign up
          </button>
        </div>
      </div>
    </main>
  );
}