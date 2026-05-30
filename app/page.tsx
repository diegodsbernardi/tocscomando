import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { LogoutButton } from "@/components/LogoutButton";
import { TodayHero } from "@/components/dashboard/TodayHero";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { CaptureActionCard } from "@/components/dashboard/CaptureActionCard";
import { ExtrasMiniCard } from "@/components/dashboard/ExtrasMiniCard";
import { firstName, greetingForNow } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <Shell>
      <TopBar
        greeting={{
          hour: greetingForNow(),
          name: firstName(user.email) || "Você",
        }}
        rightSlot={<LogoutButton />}
      />
      <TodayHero />
      <QuickStats />
      <CaptureActionCard />
      <ExtrasMiniCard />
    </Shell>
  );
}
