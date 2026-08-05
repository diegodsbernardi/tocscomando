#!/usr/bin/env node
/**
 * Debug: como trazer TODAS as vendas do dia (não só as 25 primeiras)?
 * Testa tamanhos de página e formas de pedir a página 2. Descartável.
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

const mk = (perPage, rownum, totalRows, loadSummary) => ({
  start_date: DATE,
  end_date: nextDay(DATE),
  id_partner_sale: [],
  id_store_shift: 0,
  id_store_partner_sale: [],
  id_store_site_data: [],
  id_sale_types: [1, 2, 3, 4],
  id_store_discount_coupon: 0,
  rows_per_page: perPage,
  rownum_initial: rownum,
  total_rows: totalRows ?? null,
  load_summary: loadSummary ?? true,
  sale_status_filter: [1, 2, 3, 4],
  add_or_discount_filter: [1, 2, 3],
});

async function main() {
  const s = await openSaiposSession();
  try {
    const hdrs = await s.warmupReport("report/sales-by-period", "sales-by-period");
    const CTX = hdrs ? { headers: hdrs } : { context: "app.report.sales-by-period" };
    const storeId = s.storeIds[0];
    const enc = (o) => encodeURIComponent(JSON.stringify(o));

    const run = async (nome, filtro) => {
      try {
        const j = await s.get(storeId, `sales-by-period?filter=${enc(filtro)}`, CTX);
        const rows = j?.rows || [];
        const ids = rows.length ? `${rows[0].id_sale}…${rows[rows.length - 1].id_sale}` : "-";
        console.log(`  ${nome.padEnd(38)} total=${String(j?.total ?? "?").padStart(4)} linhas=${String(rows.length).padStart(3)}  ${ids}`);
        return { total: Number(j?.total) || 0, rows };
      } catch (e) {
        console.log(`  ${nome.padEnd(38)} ERRO ${e.message.slice(0, 90)}`);
        return { total: 0, rows: [] };
      }
    };

    const baseline = await run("perPage 25 · rownum 1", mk(25, 1));
    const T = baseline.total;
    console.log(`\n  total de vendas na janela: ${T}\n`);

    await run("perPage 25 · rownum 26", mk(25, 26));
    await run("perPage 25 · rownum 26 · total_rows", mk(25, 26, T, false));
    await run("perPage 25 · rownum 26 · summary on", mk(25, 26, T, true));
    await run(`perPage ${T} (= total)`, mk(T, 1));
    await run(`perPage ${T - 1}`, mk(T - 1, 1));
    await run("perPage 50", mk(50, 1));
    await run("perPage 40", mk(40, 1));
    await run("perPage 26", mk(26, 1));
  } catch (e) {
    console.error("[dbg] falhou:", e.message);
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
