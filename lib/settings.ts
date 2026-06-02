import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_GOAL = 8000;

export const getDailyRevenueGoal = cache(async (): Promise<number> => {
  const supabase = createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "revenue_goal_daily")
    .maybeSingle();
  if (!data) return DEFAULT_GOAL;
  const n = Number(data.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GOAL;
});
