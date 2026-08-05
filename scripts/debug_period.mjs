#!/usr/bin/env node
/**
 * Debug pontual: qual campo do filtro faz o sales-by-period voltar vazio?
 *
 * Roda uma matriz de variantes do filtro na loja alvo e mostra quantas linhas
 * cada uma devolve. Descartável — some quando a conferência estiver fechada.
 * Somente GET. Env: SAIPOS_DATE, SAIPOS_DEBUG_STORE (default 2ª loja).
 */

import { openSaiposSession } from "./lib/saipos_session.mjs";

const DATE = process.env.SAIPOS_DATE || "04/08/2026";
const enc = (o) => encodeURIComponent(JSON.stringify(o));

const base = {
  start_date: DATE,
  end_date: DATE,
  id_partner_sale: [],
  id_store_shift: 0,
  id_store_partner_sale: [],
  id_store_site_data: [],
  id_sale_types: ["1", "2", "3", "4"],
  id_store_discount_coupon: 0,
  rows_per_page: 500,
  rownum_initial: 1,
  total_rows: null,
  load_summary: true,
  sale_status_filter: [3],
  add_or_discount_filter: [1, 2, 3],
};

const variants = [
  ["base (status [3])", base],
  ["status [1,2,3,4]", { ...base, sale_status_filter: [1, 2, 3, 4] }],
  ["status [1]", { ...base, sale_status_filter: [1] }],
  ["status []", { ...base, sale_status_filter: [] }],
  ["sem status/desconto", (() => { const b = { ...base }; delete b.sale_status_filter; delete b.add_or_discount_filter; return b; })()],
  ["sale_types numéricos", { ...base, id_sale_types: [1, 2, 3, 4], sale_status_filter: [1, 2, 3, 4] }],
  ["sale_types []", { ...base, id_sale_types: [], sale_status_filter: [1, 2, 3, 4] }],
  ["load_summary false", { ...base, load_summary: false, sale_status_filter: [1, 2, 3, 4] }],
  ["total_rows 0", { ...base, total_rows: 0, sale_status_filter: [1, 2, 3, 4] }],
  ["rownum_initial 0", { ...base, rownum_initial: 0, sale_status_filter: [1, 2, 3, 4] }],
  ["janela 01→06/08", { ...base, start_date: "01/08/2026", end_date: "06/08/2026", sale_status_filter: [1, 2, 3, 4] }],
];

async function main() {
  const s = await openSaiposSession();
  try {
    const storeId = process.env.SAIPOS_DEBUG_STORE || s.storeIds[1] || s.storeIds[0];
    console.log(`\n[dbg] loja ${storeId} · ${DATE}\n`);

    // Filtro copiado da chamada real do app (espião de tela): sale types
    // numéricos, arrays de canal vazios e — o detalhe que faltava — page pequena.
    const real = (perPage) => ({
      start_date: DATE,
      end_date: DATE,
      id_partner_sale: [],
      id_store_shift: 0,
      id_store_partner_sale: [],
      id_store_site_data: [],
      id_sale_types: [1, 2, 3, 4],
      id_store_discount_coupon: 0,
      rows_per_page: perPage,
      rownum_initial: 1,
      total_rows: null,
      load_summary: true,
      sale_status_filter: [1, 2, 3, 4],
      add_or_discount_filter: [1, 2, 3],
    });

    for (const perPage of [25, 50, 100, 200, 500]) {
      try {
        const j = await s.get(storeId, `sales-by-period?filter=${enc(real(perPage))}`);
        const rows = j?.rows || [];
        console.log(`  rows_per_page=${String(perPage).padStart(4)} → total=${j?.total ?? "?"} linhas=${rows.length}`);
        if (rows.length) {
          console.log(`     keys=${Object.keys(rows[0]).join(",")}`);
          console.log(`     ex=${JSON.stringify(rows[0]).slice(0, 600)}`);
          if (j?.summary) console.log(`     summary=${JSON.stringify(j.summary).slice(0, 600)}`);
          break;
        }
      } catch (e) {
        console.log(`  rows_per_page=${perPage} → ERRO ${e.message.slice(0, 120)}`);
      }
    }
  } catch (e) {
    console.error("[dbg] falhou:", e.message);
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
