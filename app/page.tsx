import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { LogoutButton } from "@/components/LogoutButton";
import { TodayHero } from "@/components/dashboard/TodayHero";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { CaptureActionCard } from "@/components/dashboard/CaptureActionCard";
import { ExtrasMiniCard } from "@/components/dashboard/ExtrasMiniCard";
import { CloseDayCard } from "@/components/dashboard/CloseDayCard";
import { firstName, greetingForNow } from "@/lib/format";
import { getCurrentProfile, roleLabel } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const name = profile?.display_name || firstName(user.email) || "Você";

  return (
    <Shell>
      <TopBar
        greeting={{
          hour: greetingForNow(),
          name,
        }}
        role={roleLabel(profile)}
        rightSlot={<LogoutButton />}
      />
      <TodayHero />
      <QuickStats />
      <CaptureActionCard />
      <CloseDayCard />
      <ExtrasMiniCard />
    </Shell>
  );
}
