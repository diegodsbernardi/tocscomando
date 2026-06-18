import Link from "next/link";
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

  const isAdmin = profile?.role === "admin";

  return (
    <Shell>
      <TopBar
        greeting={{
          hour: greetingForNow(),
          name,
        }}
        role={roleLabel(profile)}
        rightSlot={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/painel"
                aria-label="Painel analítico"
                className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-white text-navy shadow-card hover:bg-line"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </Link>
            )}
            <LogoutButton />
          </div>
        }
      />
      <TodayHero />
      <QuickStats />
      <CaptureActionCard />
      <CloseDayCard />
      <ExtrasMiniCard />
    </Shell>
  );
}
