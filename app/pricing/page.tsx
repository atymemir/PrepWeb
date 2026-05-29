'use client';
export const dynamic = 'force-dynamic';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/app/lib/supabase";
import {
  TIER_DEFINITIONS,
  normalizePlanTier,
  tierDefinition,
  tierTone,
  type PlanTier,
} from "@/app/lib/productTiers";
import { errorMessage } from "@/app/lib/errors";
import { Card, PageHeader, Pill, PrimaryButton, SecondaryButton } from "@/app/ui/ui";

type ProfileTierRow = {
  id: string;
  plan_tier: string | null;
};

export default function PricingPage() {
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("free");

  const currentTier = useMemo(() => tierDefinition(planTier), [planTier]);

  async function load() {
    setErr(null);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error(error.message);

      const uid = data.session?.user.id ?? null;
      setHasSession(!!uid);
      setUserId(uid);

      if (!uid) {
        setPlanTier("free");
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("id,plan_tier")
        .eq("id", uid)
        .single();
      if (
        profileRes.error &&
        String(profileRes.error.message || "").toLowerCase().includes("plan_tier")
      ) {
        setPlanTier("free");
        return;
      }
      if (profileRes.error) throw new Error(profileRes.error.message);

      const row = profileRes.data as ProfileTierRow;
      setPlanTier(normalizePlanTier(row.plan_tier ?? "free"));
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to load tiers."));
    }
  }

  async function chooseTier(nextTier: PlanTier) {
    if (!userId || busyTier) return;

    setBusyTier(nextTier);
    setErr(null);
    setMsg(null);

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("profiles")
        .update({ plan_tier: nextTier })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      setPlanTier(nextTier);
      setMsg(`Plan updated to ${tierDefinition(nextTier).label}.`);
    } catch (e: unknown) {
      setErr(errorMessage(e, "Failed to update tier."));
    } finally {
      setBusyTier(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen">
      <PageHeader
        label="Plans"
        title="Plans"
        subtitle="Start free. Upgrade only when you need deeper practice and coaching features."
        right={<Pill text={hasSession ? `${currentTier.label} plan` : "Public view"} tone={tierTone(planTier)} />}
      />

      <section className="ink-surface overflow-hidden rounded-[30px] border border-[#213258] bg-[linear-gradient(145deg,#0f172a,#111827_46%,#0b1222)] shadow-xl">
        <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center rounded-full border border-[#3f5fa1] bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#bdd5ff]">
              Plan overview
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              One study system, different depth.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d2dbec]">
              Free gives the core daily workflow. Pro unlocks deeper execution tools. Ultimate increases coaching throughput for heavy users.
            </p>
            <div className="mt-5 grid gap-3 sm:max-w-xl sm:grid-cols-2">
              {hasSession ? (
                <>
                  <PrimaryButton href="/today">Back to app</PrimaryButton>
                  <SecondaryButton href="/practice?subject=Reading">Start a block</SecondaryButton>
                </>
              ) : (
                <>
                  <PrimaryButton href="/login?mode=signup">Start free</PrimaryButton>
                  <SecondaryButton href="/login">Sign in</SecondaryButton>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Free</div>
              <div className="mt-1 text-sm text-[#d2dbec]">Core loop + recent history + SAT tools layer.</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Pro</div>
              <div className="mt-1 text-sm text-[#d2dbec]">Exam mode, full replay depth, AI strategist routing.</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a6c5ff]">Ultimate</div>
              <div className="mt-1 text-sm text-[#d2dbec]">Higher coach throughput and deeper long-window analytics.</div>
            </div>
          </div>
        </div>
      </section>

      {msg && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {msg}
        </div>
      )}
      {err && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {TIER_DEFINITIONS.map((tier) => {
          const active = tier.key === planTier;
          return (
            <Card
              key={tier.key}
              title={tier.label}
              subtitle={tier.tagline}
              right={<Pill text={active ? "Current" : "Available"} tone={active ? tierTone(tier.key) : "neutral"} />}
              accent={tier.key !== "free"}
              prominence={active ? "prominent" : "default"}
            >
              <div className="text-2xl font-semibold tracking-tight text-[#0f172a]">
                {tier.monthlyUsd === 0 ? "$0" : `$${tier.monthlyUsd}`}
                <span className="ml-1 text-sm font-medium text-gray-500">/month</span>
              </div>
              {tier.yearlyUsd > 0 && (
                <div className="mt-1 text-xs text-gray-600">Annual equivalent: ${tier.yearlyUsd}/month</div>
              )}

              <div className="mt-4 grid gap-2">
                {tier.includes.map((item) => (
                  <div key={`${tier.key}-${item}`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600">
                History cap: {tier.limits.historySessionLimit} sessions
                <span className="mx-2 text-gray-300">•</span>
                Exam mode: {tier.limits.examMode ? "On" : "Off"}
                <span className="mx-2 text-gray-300">•</span>
                Coach AI: {tier.limits.coachAi ? `On (${tier.limits.coachRateLimitPer10Min}/10m)` : "Off"}
              </div>

              <div className="mt-4">
                {!hasSession ? (
                  <PrimaryButton href="/login?mode=signup">Create account</PrimaryButton>
                ) : active ? (
                  <SecondaryButton disabled>Current plan</SecondaryButton>
                ) : (
                  <PrimaryButton
                    onClick={() => void chooseTier(tier.key)}
                    disabled={busyTier !== null}
                  >
                    {busyTier === tier.key ? "Updating…" : `Switch to ${tier.label}`}
                  </PrimaryButton>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-[#c7dbff] bg-[#f6faff] p-4 text-sm text-gray-700">
        This build uses direct plan switching for testing. Billing/checkout integration is separate.
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-black"
        >
          Back to product
        </Link>
        <Link
          href="/today"
          className="inline-flex rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:text-black"
        >
          Open app
        </Link>
      </div>
    </main>
  );
}
