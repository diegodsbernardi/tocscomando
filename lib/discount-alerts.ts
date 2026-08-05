import { cache } from "react";
import { todayISO } from "./dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Alerta de desconto no PDV.
 *
 * O Saipos registra dois tipos de desconto na venda: o cupom do marketplace
 * (iFood e afins, que vem como "Voucher Parceiro Desconto" na forma de
 * pagamento) e o desconto batido à mão no PDV. O primeiro é promoção
 * combinada; o segundo é margem saindo sem rastro — e é o que alertamos.
 *
 * Fonte: saipos_daily_sales / saipos_discount_sales, populadas por
 * scripts/vendas_do_dia.mjs.
 */

/** Janela de análise, em dias (inclui hoje). */
export const LOOKBACK_DAYS = 14;
/** % do valor de menu em desconto manual a partir do qual o dia vira "dia alto". */
export const PCT_ALERTA = 3;
/** Nº de dias altos na janela a partir do qual vira "recorrente" (warn). */
export const DIAS_RECORRENTE = 3;
/** Desconto manual acumulado (R$) na janela a partir do qual vira "grave". */
export const ACUMULADO_GRAVE = 500;

export type StoreDiscountAlert = {
  storeId: string;
  /** Desconto manual acumulado na janela, em R$. */
  acumulado: number;
  /** Valor de menu acumulado na janela, em R$. */
  itens: number;
  /** Desconto manual como % do valor de menu na janela. */
  pct: number;
  /** Nº de dias com desconto manual acima de PCT_ALERTA. */
  diasAltos: number;
  recorrente: boolean;
  grave: boolean;
};

export type DiscountSale = {
  workDate: string;
  storeId: string;
  saleNumber: string | null;
  soldAt: string | null;
  totalAmount: number;
  discountAmount: number;
  discountReason: string | null;
  paymentTypes: string | null;
};

export type DiscountAlerts = {
  lookbackDays: number;
  startDate: string;
  endDate: string;
  stores: StoreDiscountAlert[];
  /** As maiores vendas com desconto manual da janela, pra dar nome aos bois. */
  topSales: DiscountSale[];
  hasAlert: boolean;
};

function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dd = new Date(y, m - 1, d);
  dd.setDate(dd.getDate() + delta);
  return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
}

const n = (v: number | string | null) => Number(v ?? 0) || 0;

export const getDiscountAlerts = cache(async (): Promise<DiscountAlerts> => {
  const supabase = createClient();
  const endDate = todayISO();
  const startDate = shiftDays(endDate, -(LOOKBACK_DAYS - 1));
  const vazio: DiscountAlerts = {
    lookbackDays: LOOKBACK_DAYS,
    startDate,
    endDate,
    stores: [],
    topSales: [],
    hasAlert: false,
  };

  const { data, error } = await supabase
    .from("saipos_daily_sales")
    .select("work_date, store_id, items_amount, manual_discount_amount")
    .gte("work_date", startDate)
    .lte("work_date", endDate);
  if (error || !data?.length) return vazio;

  type Row = {
    work_date: string;
    store_id: string;
    items_amount: number | string | null;
    manual_discount_amount: number | string | null;
  };

  const byStore = new Map<string, { acumulado: number; itens: number; diasAltos: number }>();
  for (const row of data as Row[]) {
    const itens = n(row.items_amount);
    const desc = n(row.manual_discount_amount);
    let agg = byStore.get(row.store_id);
    if (!agg) {
      agg = { acumulado: 0, itens: 0, diasAltos: 0 };
      byStore.set(row.store_id, agg);
    }
    agg.acumulado += desc;
    agg.itens += itens;
    if (itens > 0 && (desc / itens) * 100 >= PCT_ALERTA) agg.diasAltos += 1;
  }

  const stores: StoreDiscountAlert[] = Array.from(byStore.entries())
    .map(([storeId, a]) => ({
      storeId,
      acumulado: a.acumulado,
      itens: a.itens,
      pct: a.itens > 0 ? (a.acumulado / a.itens) * 100 : 0,
      diasAltos: a.diasAltos,
      recorrente: a.diasAltos >= DIAS_RECORRENTE,
      grave: a.acumulado >= ACUMULADO_GRAVE,
    }))
    .sort((x, y) => y.acumulado - x.acumulado);

  const hasAlert = stores.some((s) => s.recorrente || s.grave);

  // Só busca o detalhe se houver alerta — é o que o card vai listar.
  let topSales: DiscountSale[] = [];
  if (hasAlert) {
    const { data: sales } = await supabase
      .from("saipos_discount_sales")
      .select("work_date, store_id, sale_number, sold_at, total_amount, discount_amount, discount_reason, payment_types")
      .eq("is_partner_voucher", false)
      .gte("work_date", startDate)
      .lte("work_date", endDate)
      .order("discount_amount", { ascending: false })
      .limit(10);
    topSales = (sales || []).map((s) => ({
      workDate: s.work_date as string,
      storeId: s.store_id as string,
      saleNumber: (s.sale_number as string) ?? null,
      soldAt: (s.sold_at as string) ?? null,
      totalAmount: n(s.total_amount as number),
      discountAmount: n(s.discount_amount as number),
      discountReason: (s.discount_reason as string) ?? null,
      paymentTypes: (s.payment_types as string) ?? null,
    }));
  }

  return { lookbackDays: LOOKBACK_DAYS, startDate, endDate, stores, topSales, hasAlert };
});
