import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Shell } from "@/components/ui/Shell";
import { Skeleton } from "@/components/ui/Skeleton";
import { TopBar } from "@/components/ui/TopBar";
import { LogoutButton } from "@/components/LogoutButton";
import { TodayHero } from "@/components/dashboard/TodayHero";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { CaptureActionCard } from "@/components/dashboard/CaptureActionCard";
import { ExtrasMiniCard } from "@/components/dashboard/ExtrasMiniCard";
import { CloseDayCard } from "@/components/dashboard/CloseDayCard";
import { DayNotClosedBanner } from "@/components/dashboard/DayNotClosedBanner";
import { SuggestionsCard } from "@/components/dashboard/SuggestionsCard";
import { DrawerSwitcher } from "@/components/DrawerSwitcher";
import { createClient } from "@/lib/supabase/server";
import { firstName, greetingForNow } from "@/lib/format";
import { getAuthUser, getCurrentProfile, roleLabel } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const name = profile?.display_name || firstName(user.email) || "Você";

  const isAdmin = profile?.role === "admin";

  // Operador pode trocar de loja/caixa (às vezes eles se trocam no dia)
  let drawers: { id: string; name: string }[] = [];
  if (!isAdmin) {
    const supabase = createClient();
    const { data } = await supabase
      .from("cash_drawers")
      .select("id, name")
      .eq("active", true)
      .order("name");
    drawers = data || [];
  }

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
      {!isAdmin && drawers.length > 0 && (
        <DrawerSwitcher drawers={drawers} currentDrawerId={profile?.default_drawer_id ?? null} />
      )}
      {/* Cards com query própria fazem streaming: a home aparece na hora
          e cada card entra quando o dado chega */}
      <Suspense fallback={null}>
        <DayNotClosedBanner />
      </Suspense>
      <Suspense fallback={<Skeleton className="mx-4 mt-3 h-[220px] rounded-hero" />}>
        <TodayHero />
      </Suspense>
      <Suspense fallback={<Skeleton className="mx-4 mt-4 h-[76px] rounded-card" />}>
        <QuickStats />
      </Suspense>
      <CaptureActionCard />
      <CloseDayCard />
      <Suspense fallback={<Skeleton className="mx-4 mt-4 h-[104px] rounded-card" />}>
        <ExtrasMiniCard />
      </Suspense>
      <SuggestionsCard />
    </Shell>
  );
}
