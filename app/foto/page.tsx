import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CaptureForm } from "@/components/CaptureForm";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";

export const dynamic = "force-dynamic";

export default async function FotoPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <Shell>
      <TopBar
        title="Novo relatório"
        subtitle="Tira a foto do cupom Safrapay"
        backHref="/"
        rightSlot={
          <Link
            href="/historico"
            className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-line"
          >
            Histórico
          </Link>
        }
      />
      <div className="mt-2 px-4">
        <CaptureForm />
      </div>
    </Shell>
  );
}
