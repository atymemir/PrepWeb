'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [msg, setMsg] = useState<string | null>(null);
  const [nextAfterAuth, setNextAfterAuth] = useState("/today");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data.session) {
          router.replace("/today");
          return;
        }

        setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") {
      setMode("signup");
    }
    const nextParam = params.get("next");
    if (nextParam && nextParam.startsWith("/")) {
      setNextAfterAuth(nextParam);
    }
  }, []);

  async function signIn() {
    setBusy(true);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }
      router.push(nextAfterAuth);
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    setBusy(true);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Account created. Now sign in.");
      setMode("signin");
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6">
          <div className="text-sm text-gray-600">Checking session…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] grid items-center">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
            ALGA Account
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Sign in and continue the loop.
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600">
            Your account keeps practice, review, mastery movement, and history in one loop.
          </p>

          <div className="mt-6 rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">First action after login</div>
            <div className="mt-2 text-sm font-semibold text-[#0f172a]">Open Today and run one full practice block.</div>
            <div className="mt-1 text-xs text-gray-600">
              The system needs one completed block to start routing recovery and mastery.
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">1. Practice</div>
              <div className="mt-1 text-sm text-gray-700">Generate signal</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">2. Review</div>
              <div className="mt-1 text-sm text-gray-700">Clear due debt</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">3. Skills</div>
              <div className="mt-1 text-sm text-gray-700">Target one weak subtopic</div>
            </div>
          </div>

          <div className="mt-6 text-xs text-gray-500">New here? Create an account in under a minute.</div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("signin")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === "signin"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-black"
              }`}
            >
              Sign in
            </button>

            <button
              onClick={() => setMode("signup")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-black"
              }`}
            >
              Sign up
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Email</label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Password</label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
          </div>

          {msg && (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm ${
                msg.toLowerCase().includes("created")
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {msg}
            </div>
          )}

          <div className="mt-6 grid gap-3">
            {mode === "signin" ? (
              <button
                onClick={signIn}
                disabled={busy || !email || !password}
                className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            ) : (
              <button
                onClick={signUp}
                disabled={busy || !email || !password}
                className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Creating account…" : "Create account"}
              </button>
            )}

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-50"
            >
              Back to home
            </Link>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            By continuing, you’re using ALGA as a training tool — not a score promise machine.
          </div>
        </section>
      </div>
    </main>
  );
}
