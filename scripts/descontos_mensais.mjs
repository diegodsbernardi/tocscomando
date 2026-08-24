#!/usr/bin/env node
/**
 * Descontos, ticket e movimento MENSAL por loja — pela TELA do Saipos.
 *
 * Por que pela tela e não pela API: o backend assina a query (x-fingerprint).
 * Um filtro montado por nós devolve 200 com total=0 — foi o que aconteceu na
 * primeira versão deste script. Então quem monta a busca é a própria tela:
 * preenchemos as datas do mês, clicamos Buscar e capturamos o `summary` da
 * resposta, que já vem agregado (não precisa paginar as vendas).
 *
 * Uma sessão por loja (o Saipos entra numa loja por login).
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

/** Início e fim do mês em DD/MM/YYYY. A janela do relatório é fechada nas duas pontas. */
function janela(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `01/${mm}/${y}`, end: `${ultimo}/${mm}/${y}` };
}

const CAMPOS = [
  "sales_count",
  "total_amount_items",
  "total_discount_amount",
  "total_increase_amount",
  "delivery_fee_amount",
  "service_charge_amount",
  "sales_amount",
];

async function coletarLoja(storeId, lista, linhas) {
  process.env.SAIPOS_STORE_IDS = storeId; // a sessão entra nesta loja
  const s = await openSaiposSession();
  const respostas = [];

  try {
    s.page.on("response", async (res) => {
      if (!res.url().includes("sales-by-period")) return;
      try {
        const j = await res.json();
        if (j && j.summary) respostas.push(j.summary);
      } catch {}
    });

    // O app é Angular com rota por hash: trocar só o hash não remonta a tela.
    // Por isso o goto vem seguido de reload, e esperamos o campo de data
    // aparecer de fato em vez de dormir um tempo fixo.
    const base = (process.env.SAIPOS_BASE_URL || "https://app.saipos.com").replace(/\/$/, "");
    const SEL_DATA = '.md-datepicker-input, input[type="date"], md-datepicker input';

    await s.page.goto(`${base}/#/app/report/sales-by-period`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await s.page.waitForTimeout(4000);
    await s.page.reload({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await s.page.waitForSelector(SEL_DATA, { timeout: 60000 }).catch(() => {});
    await s.page.waitForTimeout(4000);

    const inputs = s.page.locator(SEL_DATA);
    let qtd = await inputs.count().catch(() => 0);
    if (qtd < 2) {
      // Segunda tentativa: às vezes o primeiro carregamento cai no kanban.
      console.log(`[desc] loja ${storeId}: ${qtd} campo(s) — recarregando a tela`);
      await s.page.goto(`${base}/#/app/report/sales-by-period`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
      await s.page.waitForSelector(SEL_DATA, { timeout: 60000 }).catch(() => {});
      await s.page.waitForTimeout(5000);
      qtd = await inputs.count().catch(() => 0);
    }
    if (qtd < 2) {
      console.log(`[desc] loja ${storeId}: não achei os campos de data (${qtd}) — abortando esta loja`);
      console.log(`[desc] URL atual: ${s.page.url()}`);
      return;
    }
    console.log(`[desc] loja ${storeId}: ${qtd} campos de data — começando`);

    for (const ym of lista) {
      const { start, end } = janela(ym);
      const antes = respostas.length;

      for (const [i, valor] of [[0, start], [1, end]]) {
        const el = inputs.nth(i);
        await el.click({ timeout: 5000 }).catch(() => {});
        await el.fill("").catch(() => {});
        await el.type(valor, { delay: 55 }).catch(() => {});
        await s.page.keyboard.press("Escape").catch(() => {});
      }

      const buscar = s.page.locator('button:has-text("Buscar")').first();
      if (await buscar.count().catch(() => 0)) {
        await buscar.click().catch(() => {});
      }
      // Mês inteiro demora mais que um dia — dá tempo do relatório voltar.
      await s.page.waitForTimeout(12000);

      const sm = respostas.length > antes ? respostas[respostas.length - 1] : null;
      if (!sm) {
        console.log(`  loja ${storeId} · ${ym} · SEM RESPOSTA`);
        linhas.push({ storeId, ym, vazio: true });
        continue;
      }
      const r = { storeId, ym };
      for (const c of CAMPOS) r[c] = num(sm[c]);
      const ticket = r.sales_count ? r.sales_amount / r.sales_count : 0;
      const pct = r.total_amount_items ? (r.total_discount_amount / r.total_amount_items) * 100 : 0;
      linhas.push(r);
      console.log(
        `  loja ${storeId} · ${ym} · ${String(r.sales_count).padStart(5)} vendas · itens ${brl(r.total_amount_items).padStart(14)} · desconto ${brl(r.total_discount_amount).padStart(12)} (${pct.toFixed(1).padStart(4)}%) · ticket ${brl(ticket)}`,
      );
    }
  } finally {
    await s.close();
  }
}

async function main() {
  const lista = meses(INICIO, FIM);
  const lojas = (process.env.SAIPOS_STORE_IDS || "49895,49897").split(",").map((x) => x.trim());
  const linhas = [];

  console.log(`[desc] ${lojas.length} lojas x ${lista.length} meses (${INICIO} → ${FIM})\n`);
  for (const loja of lojas) {
    await coletarLoja(loja, lista, linhas);
    console.log("");
  }

  const csv = ["loja;mes;" + CAMPOS.join(";") + ";ticket_medio;pct_desconto"];
  for (const r of linhas) {
    if (r.vazio) { csv.push(`${r.storeId};${r.ym};;;;;;;;`); continue; }
    const ticket = r.sales_count ? r.sales_amount / r.sales_count : 0;
    const pct = r.total_amount_items ? (r.total_discount_amount / r.total_amount_items) * 100 : 0;
    csv.push([r.storeId, r.ym, ...CAMPOS.map((c) => r[c].toFixed(2)), ticket.toFixed(2), pct.toFixed(2)].join(";"));
  }
  writeFileSync(SAIDA, csv.join("\n") + "\n", "utf8");
  console.log(`[desc] CSV salvo em ${SAIDA}`);
}

main().catch((e) => {
  console.error("[desc] falhou:", e);
  process.exit(1);
});
