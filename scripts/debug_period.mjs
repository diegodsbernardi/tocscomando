#!/usr/bin/env node
/**
 * Debug: por que a mesma query devolve 44 linhas pelo app e 0 por nós?
 * Testa encoding (JSON cru x percent-encoded), tamanho de página e janela.
 * Descartável. Somente GET.
 */

import { openSaiposSession } from "./lib/saipos_session.mjs";

const DATE = process.env.SAIPOS_DATE || "04/08/2026";

function nextDay(br) {
  const [d, m, y] = br.split("/");
  const dt = new Date(`${y}-${m}-${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  const [yy, mm, dd] = dt.toISOString().slice(0, 10).split("-");
  return `${dd}/${mm}/${yy}`;
}

const filtro = (perPage, end) => ({
  start_date: DATE,
  end_date: end,
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

async function main() {
  const s = await openSaiposSession();
  try {
    const headers = (await s.warmupReport("report/sales-by-period", "sales-by-period")) || s.headersForApi("app.report.sales-by-period");
    const storeId = s.storeIds[0];
    const casos = [
      ["cru       · 25 · janela aberta", JSON.stringify(filtro(25, nextDay(DATE))), false],
      ["encoded   · 25 · janela aberta", JSON.stringify(filtro(25, nextDay(DATE))), true],
      ["cru       · 100· janela aberta", JSON.stringify(filtro(100, nextDay(DATE))), false],
      ["cru       · 25 · janela fechada", JSON.stringify(filtro(25, DATE)), false],
    ];
    for (const [nome, json, encode] of casos) {
      const qs = encode ? encodeURIComponent(json) : json;
      const url = `https://api.saipos.com/v1/stores/${storeId}/sales-by-period?filter=${qs}`;
      try {
        const res = await s.page.request.get(url, { headers, timeout: 30000 });
        const j = await res.json();
        console.log(`  ${nome} → HTTP ${res.status()} total=${j?.total ?? "?"} linhas=${(j?.rows || []).length}`);
      } catch (e) {
        console.log(`  ${nome} → ERRO ${e.message.slice(0, 120)}`);
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
