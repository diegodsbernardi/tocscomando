import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaptureForm } from "@/components/CaptureForm";
import { LogoutButton } from "@/components/LogoutButton";
import { TodayStatsCard } from "@/components/TodayStatsCard";
import { ExtrasPendingCard } from "@/components/ExtrasPendingCard";
import { CashStatusCard } from "@/components/CashStatusCard";
import { MotoboysTodayCard } from "@/components/MotoboysTodayCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">TOCS</h1>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/caixa"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Caixa
          </Link>
          <Link
            href="/motoboys"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Motoboys
          </Link>
          <Link
            href="/extras"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Extras
          </Link>
          <Link
            href="/historico"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Relatórios
          </Link>
          <LogoutButton />
        </div>
      </header>

      <TodayStatsCard />

      <CashStatusCard />

      <MotoboysTodayCard />

      <ExtrasPendingCard />

      <CaptureForm />
    </main>
  );
}
