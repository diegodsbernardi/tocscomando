import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { startOfDayISO } from "@/lib/dates";

/**
 * Aviso quando nenhum cupom da maquininha foi fotografado hoje.
 * Server component: renderiza null se já houver cupom (ou em erro de query).
 */
export async function NoCouponWarning() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id")
    .gte("created_at", startOfDayISO())
    .limit(1);

  if (error || (data && data.length > 0)) return null;

  return (
    <div className="rounded-card bg-danger-bg p-4 shadow-card">
      <p className="text-sm font-bold leading-snug text-danger">
        📷 Nenhum cupom da maquininha fotografado hoje
      </p>
      <p className="mt-1 text-[12px] leading-snug text-danger/80">
        Antes de fechar, tira a foto do cupom de fechamento de cada maquininha —
        é ele que comprova os cartões do dia.
      </p>
      <Link
        href="/foto"
        className="mt-3 block min-h-[44px] rounded-xl bg-danger py-3 text-center text-sm font-bold text-white"
      >
        Fotografar agora
      </Link>
    </div>
  );
}
