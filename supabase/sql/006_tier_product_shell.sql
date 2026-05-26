-- Tiered product shell foundation for ALGA.
-- Goals:
-- 1) durable plan tier truth on profiles
-- 2) zero disruption to current learning/review scheduling
-- 3) additive only

alter table public.profiles
  add column if not exists plan_tier text
  not null
  default 'free'
  check (plan_tier in ('free', 'pro', 'ultimate'));

create index if not exists profiles_plan_tier_idx
  on public.profiles (plan_tier);

comment on column public.profiles.plan_tier is
  'Product tier shell: free | pro | ultimate. Used for feature access + UX routing.';

