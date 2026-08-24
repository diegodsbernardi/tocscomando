#!/usr/bin/env node
/**
 * Descontos e ticket MENSAL por loja — para separar movimento de faturamento.
 *
 * Fonte: sales-by-period com load_summary. O summary do relatório traz, para a
 * janela pedida: nº de vendas, valor de menu (itens), desconto, acréscimo,
 * taxa de entrega e serviço. Uma chamada por loja por mês.
 *
 * Os headers vêm do warmup da própria tela (o backend assina a query); se o
 * summary voltar vazio, o log avisa em vez de fingir que o mês foi zero.
 *
 * Só leitura. Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_STORE_IDS,
 *                  DESC_INICIO / DESC_FIM (YYYY-MM), DESC_SAIDA.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const INICIO = process.env.DESC_INICIO || "2025-01";
const FIM =
  process.env.DESC_FIM ||
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);
const SAIDA = process.env.DESC_SAIDA || "descontos-mensais.csv";

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => Number(String(v ?? 0).replace(",", ".")) || 0;

function meses(de, ate) {
  const out = [];
  let [y, m] = de.split("-").map(Number);
  const [yf, mf] = ate.split("-").map(Number);
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y += 1; }
  }
  return out;
}

/** Janela DD/MM/YYYY do mês. O fim é exclusivo no relatório, então vai dia 1 do mês seguinte. */
function janela(ym) {
  const [y, m] = ym.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const prox = m === 12 ? `01/01/${y + 1}` : `01/${String(m + 1).padStart(2, "0")}/${y}`;
  return { start: `01/${mm}/${y}`, end: prox };
}

const CAMPOS = [
  "sales_count",
  "total_amount_items",
  "total_discount_amount",
  "total_increase_amount",
  "delivery_fee_amount",
  "service_charge_amount",
  "sales_amount",
  "canceled_sales_amount",
];

async function main() {
  const lista = meses(INICIO, FIM);
  const s = await openSaiposSession();
  const linhas = [];

  try {
    const hdrs = await s.warmupReport("report/sales-by-period", "sales-by-period");
    const CTX = hdrs ? { headers: hdrs } : { context: "app.report.sales-by-period" };
    console.log(`[desc] ${s.storeIds.length} lojas x ${lista.length} meses\n`);

    let mostrouCru = false;
    for (const storeId of s.storeIds) {
      for (const ym of lista) {
        const { start, end } = janela(ym);
        const filtro = encodeURIComponent(
          JSON.stringify({
            start_date: start,
            end_date: end,
            id_partner_sale: [],
            id_store_shift: 0,
            id_store_partner_sale: [],
            id_store_site_data: [],
            id_sale_types: [1, 2, 3, 4],
            id_store_discount_coupon: 0,
            rows_per_page: 1,
            rownum_initial: 1,
            total_rows: null,
            load_summary: true,
            sale_status_filter: [1, 2, 3, 4],
            add_or_discount_filter: [1, 2, 3],
          }),
        );
        try {
          const j = await s.get(storeId, `sales-by-period?filter=${filtro}`, CTX);
          const sm = j?.summary;
          if (!sm) {
            console.log(`  loja ${storeId} · ${ym} · SEM SUMMARY (total=${j?.total ?? "?"})`);
            linhas.push({ storeId, ym, vazio: true });
            continue;
          }
          if (!mostrouCru) {
            console.log(`  [summary bruto] ${JSON.stringify(sm)}\n`);
            mostrouCru = true;
          }
          const r = { storeId, ym };
          for (const c of CAMPOS) r[c] = num(sm[c]);
          const ticket = r.sales_count ? r.sales_amount / r.sales_count : 0;
          const pctDesc = r.total_amount_items ? (r.total_discount_amount / r.total_amount_items) * 100 : 0;
          linhas.push(r);
          console.log(
            `  loja ${storeId} · ${ym} · ${String(r.sales_count).padStart(5)} vendas · itens ${brl(r.total_amount_items).padStart(14)} · desconto ${brl(r.total_discount_amount).padStart(12)} (${pctDesc.toFixed(1).padStart(4)}%) · ticket ${brl(ticket)}`,
          );
        } catch (e) {
          console.log(`  loja ${storeId} · ${ym} · ERRO ${e.message.slice(0, 100)}`);
          linhas.push({ storeId, ym, vazio: true });
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      console.log("");
    }
  } finally {
    await s.close();
  }

  const csv = ["loja;mes;" + CAMPOS.join(";") + ";ticket_medio;pct_desconto"];
  for (const r of linhas) {
    if (r.vazio) { csv.push(`${r.storeId};${r.ym};;;;;;;;;`); continue; }
    const ticket = r.sales_count ? r.sales_amount / r.sales_count : 0;
    const pct = r.total_amount_items ? (r.total_discount_amount / r.total_amount_items) * 100 : 0;
    csv.push(
      [r.storeId, r.ym, ...CAMPOS.map((c) => r[c].toFixed(2)), ticket.toFixed(2), pct.toFixed(2)].join(";"),
    );
  }
  writeFileSync(SAIDA, csv.join("\n") + "\n", "utf8");
  console.log(`[desc] CSV salvo em ${SAIDA}`);
}

main().catch((e) => {
  console.error("[desc] falhou:", e);
  process.exit(1);
});
