import { getSupabase } from "./supabase";
import { normalizePlanTier, tierDefinition, type PlanTier, type TierDefinition } from "./productTiers";

type ProfileTierRow = {
  plan_tier: string | null;
};

export async function getMyPlanTier(): Promise<PlanTier> {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw new Error(sessionErr.message);
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("You need to sign in.");

  const { data, error } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return normalizePlanTier((data as ProfileTierRow | null)?.plan_tier ?? "free");
}

export async function getMyTierDefinition(): Promise<TierDefinition> {
  const tier = await getMyPlanTier();
  return tierDefinition(tier);
}

