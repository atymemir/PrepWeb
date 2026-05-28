'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/app/lib/supabase";

type AuthMode = "signin" | "signup";
type OAuthProvider = "google";

function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/today";
  if (!raw.startsWith("/")) return "/today";
  return raw;
}

function oauthErrorHint(provider: OAuthProvider, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("provider") && (m.includes("disabled") || m.includes("not enabled") || m.includes("not found"))) {
    return "Google sign-in is not configured yet for this project. Use email/password for now, then enable Google in Supabase Auth providers.";
  }
  return message;
}

function decodeSafe(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function oauthErrorFromLocation(searchParams: ReturnType<typeof useSearchParams>): string | null {
  if (typeof window === "undefined") return null;

  const fromQuery =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    searchParams.get("error_code");
  const fromQueryDecoded = fromQuery ? decodeSafe(fromQuery) : null;

  const hash = window.location.hash;
  let fromHashDecoded: string | null = null;
  if (hash) {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const fromHash =
      params.get("error_description") ||
      params.get("error") ||
      params.get("error_code");
    fromHashDecoded = fromHash ? decodeSafe(fromHash) : null;
  }

  const raw = fromQueryDecoded || fromHashDecoded;
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower.includes("provider") || lower.includes("not enabled") || lower.includes("not found")) {
    const storedProvider = window.sessionStorage.getItem("alga-oauth-provider");
    if (storedProvider === "google") {
      return oauthErrorHint(storedProvider, raw);
    }
  }

  return raw;
}

function LoginLoadingShell() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6">
        <div className="text-sm text-gray-600">Checking session…</div>
      </div>
    </main>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const queryNext = sanitizeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AuthMode>(() => queryMode);
  const [msg, setMsg] = useState<string | null>(() => oauthErrorFromLocation(searchParams));
  const [nextAfterAuth, setNextAfterAuth] = useState(() => queryNext);

  async function resolvePostAuthRoute(defaultNext: string): Promise<string> {
    return sanitizeNextPath(defaultNext);
  }

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("alga-oauth-provider");
        }
        const destination = await resolvePostAuthRoute(nextAfterAuth);
        router.replace(destination);
      }
    });

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data.session) {
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("alga-oauth-provider");
          }
          const destination = await resolvePostAuthRoute(nextAfterAuth);
          router.replace(destination);
          return;
        }

        setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, nextAfterAuth]);

  const authTarget = useMemo(() => {
    if (typeof window === "undefined") return "";
    const target = new URL("/login", window.location.origin);
    target.searchParams.set("next", nextAfterAuth);
    return target.toString();
  }, [nextAfterAuth]);

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

      const destination = await resolvePostAuthRoute(nextAfterAuth);
      router.push(destination);
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
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }

      if (data.session) {
        router.push("/welcome?first=1");
        return;
      }

      setMsg("Account created. Confirm email if required, then sign in to start onboarding.");
      setNextAfterAuth("/welcome?first=1");
      setMode("signin");
    } catch {
      setMsg("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startOAuth(provider: OAuthProvider) {
    setBusy(true);
    setMsg(null);

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("alga-oauth-provider", provider);
      }
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: authTarget || undefined,
        },
      });

      if (error) {
        setMsg(oauthErrorHint(provider, error.message));
      }
    } catch {
      setMsg("Could not start Google login. Try email/password.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoginLoadingShell />;
  }

  return (
    <main className="min-h-[70vh] grid items-center">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8">
          <div className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
            ALGA Account
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Sign in and start your SAT loop.
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600">
            Alga turns SAT prep into one system: Practice creates signal, Review clears debt, Skills/Lessons repair weaknesses, and History/Coach keep decisions sharp.
          </p>

          <div className="mt-6 rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#004aad]">First click after auth</div>
            <div className="mt-2 text-sm font-semibold text-[#0f172a]">Open Today mission or run your first 12-question block.</div>
            <div className="mt-1 text-xs text-gray-600">
              One completed block unlocks real review debt routing and weakest-skill targeting.
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">1. Practice</div>
              <div className="mt-1 text-sm text-gray-700">Generate signal</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">2. Review</div>
              <div className="mt-1 text-sm text-gray-700">Clear debt</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">3. Repair</div>
              <div className="mt-1 text-sm text-gray-700">Skills + Lessons</div>
            </div>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            New here? Sign up, then complete a 60-second onboarding to set target and launch first session.
          </div>
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

          <div className="mt-5 grid gap-2">
            <button
              onClick={() => void startOAuth("google")}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:bg-gray-50 disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>

          <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span>or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="space-y-4">
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
                msg.toLowerCase().includes("created") || msg.toLowerCase().includes("confirm")
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
                onClick={() => void signIn()}
                disabled={busy || !email || !password}
                className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            ) : (
              <button
                onClick={() => void signUp()}
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
            By continuing, you’re using ALGA as a training system, not a score-promise machine.
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingShell />}>
      <LoginPageInner />
    </Suspense>
  );
}
