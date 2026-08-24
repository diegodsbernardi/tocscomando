#!/usr/bin/env node
/**
 * Faturamento MENSAL por loja (CNPJ), direto do Saipos.
 *
 * Usa o mesmo endpoint do relatório "Vendas por forma de pagamento"
 * (sales-by-payment-type), que aceita janela livre de datas e devolve
 * `total_saled` — o total vendido no período — repetido em toda linha.
 * Uma chamada por loja por mês.
 *
 * Só leitura: não grava nada no Supabase.
 *
 * Env:
 *   SAIPOS_USER, SAIPOS_PASS            — login do robô (obrigatórias)
 *   SAIPOS_STORE_IDS                    — default 49895,49897
 *   FAT_INICIO                          — YYYY-MM, default 2024-01
 *   FAT_FIM                             — YYYY-MM, default mês corrente
 *   FAT_SAIDA                           — caminho do CSV, default faturamento-mensal.csv
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const INICIO = process.env.FAT_INICIO || "2024-01";
const FIM =
  process.env.FAT_FIM ||
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);
const SAIDA = process.env.FAT_SAIDA || "faturamento-mensal.csv";

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Lista de meses YYYY-MM, inclusivo nas duas pontas. */
function meses(de, ate) {
  const out = [];
  let [y, m] = de.split("-").map(Number);
  const [yf, mf] = ate.split("-").map(Number);
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Primeiro e último dia do mês em DD/MM/YYYY. */
function janela(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `01/${mm}/${y}`, end: `${ultimo}/${mm}/${y}` };
}

function filtro(start, end, onlyNfe = 0) {
  return encodeURIComponent(
    JSON.stringify({
      start_date: start,
      end_date: end,
      exclude_canceled: 1,
      only_nfe: onlyNfe,
      id_store_shift: 0,
      id_sale_types: ["1", "2", "3", "4"],
      id_user_stores: null,
    }),
  );
}

async function main() {
  const lista = meses(INICIO, FIM);
  const s = await openSaiposSession();
  const resultado = [];

  try {
    console.log(`[fat] lojas: ${s.storeIds.join(", ")} · ${lista.length} meses (${INICIO} → ${FIM})\n`);

    for (const storeId of s.storeIds) {
      for (const ym of lista) {
        const { start, end } = janela(ym);
        let total = 0;
        let vendas = 0;
        let totalNfe = 0;
        let notas = 0;
        let erro = null;
        try {
          const rows = await s.get(storeId, `sales-by-payment-type?filter=${filtro(start, end)}`);
          const arr = Array.isArray(rows) ? rows : [];
          total = arr.length ? Number(arr[0].total_saled) || 0 : 0;
          vendas = arr.length ? Number(arr[0].count_sales) || 0 : 0;
        } catch (e) {
          erro = e.message.slice(0, 120);
        }
        // Segunda passada com only_nfe=1: quantas dessas vendas saíram com nota.
        try {
          const rows = await s.get(storeId, `sales-by-payment-type?filter=${filtro(start, end, 1)}`);
          const arr = Array.isArray(rows) ? rows : [];
          totalNfe = arr.length ? Number(arr[0].total_saled) || 0 : 0;
          notas = arr.length ? Number(arr[0].count_sales) || 0 : 0;
        } catch (e) {
          erro = (erro ? erro + " | " : "") + "nfe: " + e.message.slice(0, 80);
        }
        const pct = vendas > 0 ? (notas / vendas) * 100 : 0;
        resultado.push({ storeId, ym, total, vendas, totalNfe, notas, erro });
        console.log(
          `  loja ${storeId} · ${ym} · ${brl(total).padStart(14)} · ${String(vendas).padStart(5)} vendas · notas ${String(notas).padStart(5)} (${pct.toFixed(0).padStart(3)}%) · ${brl(totalNfe).padStart(14)} com nota${erro ? ` · ERRO ${erro}` : ""}`,
        );
        // Respiro entre chamadas — a API do Saipos não gosta de rajada.
        await new Promise((r) => setTimeout(r, 700));
      }
      console.log("");
    }
  } finally {
    await s.close();
  }

  // CSV: uma linha por mês, uma coluna por loja
  const lojas = s.storeIds;
  const porMes = new Map();
  for (const r of resultado) {
    const cur = porMes.get(r.ym) || {};
    cur[r.storeId] = r;
    porMes.set(r.ym, cur);
  }
  const linhas = [
    [
      "mes",
      ...lojas.flatMap((l) => [
        `loja_${l}_faturamento`,
        `loja_${l}_vendas`,
        `loja_${l}_notas`,
        `loja_${l}_faturamento_com_nota`,
      ]),
      "total",
      "total_notas",
    ].join(";"),
  ];
  for (const ym of meses(INICIO, FIM)) {
    const m = porMes.get(ym) || {};
    const soma = lojas.reduce((a, l) => a + (m[l]?.total || 0), 0);
    const somaNotas = lojas.reduce((a, l) => a + (m[l]?.notas || 0), 0);
    linhas.push(
      [
        ym,
        ...lojas.flatMap((l) => [
          (m[l]?.total || 0).toFixed(2).replace(".", ","),
          m[l]?.vendas || 0,
          m[l]?.notas || 0,
          (m[l]?.totalNfe || 0).toFixed(2).replace(".", ","),
        ]),
        soma.toFixed(2).replace(".", ","),
        somaNotas,
      ].join(";"),
    );
  }
  writeFileSync(SAIDA, linhas.join("\n") + "\n", "utf8");
  console.log(`\n[fat] CSV salvo em ${SAIDA}`);

  // Resumo legível no log
  console.log("\n===== FATURAMENTO MENSAL =====");
  console.log(["mes", ...lojas.map((l) => `loja ${l}`), "total"].join(" | "));
  for (const ym of meses(INICIO, FIM)) {
    const m = porMes.get(ym) || {};
    const soma = lojas.reduce((a, l) => a + (m[l]?.total || 0), 0);
    console.log(
      [ym, ...lojas.map((l) => brl(m[l]?.total || 0).padStart(14)), brl(soma).padStart(14)].join(" | "),
    );
  }

  console.log("\n===== NOTAS GERADAS (only_nfe) =====");
  console.log(["mes", ...lojas.map((l) => `loja ${l}`), "total"].join(" | "));
  for (const ym of meses(INICIO, FIM)) {
    const m = porMes.get(ym) || {};
    const somaNotas = lojas.reduce((a, l) => a + (m[l]?.notas || 0), 0);
    console.log(
      [
        ym,
        ...lojas.map((l) => {
          const r = m[l];
          const pct = r && r.vendas > 0 ? ((r.notas / r.vendas) * 100).toFixed(0) : "-";
          return `${String(r?.notas || 0).padStart(5)} de ${String(r?.vendas || 0).padStart(5)} (${String(pct).padStart(3)}%)`;
        }),
        String(somaNotas).padStart(6),
      ].join(" | "),
    );
  }
  const anos = new Map();
  for (const r of resultado) {
    const ano = r.ym.slice(0, 4);
    anos.set(ano, (anos.get(ano) || 0) + r.total);
  }
  console.log("\n----- por ano (soma das lojas) -----");
  for (const [ano, v] of [...anos].sort()) console.log(`${ano}: ${brl(v)}`);
}

main().catch((e) => {
  console.error("[fat] falhou:", e);
  process.exit(1);
});
