#!/usr/bin/env node
/**
 * Faturamento DIÁRIO por loja, direto do Saipos — para análise histórica
 * (ex: cruzar venda com clima). Uma chamada por loja por dia no
 * sales-by-payment-type, que aceita janela livre e devolve `total_saled`.
 *
 * Só leitura: não grava no Supabase, cospe CSV.
 *
 * Env:
 *   SAIPOS_USER, SAIPOS_PASS   — obrigatórias
 *   SAIPOS_STORE_IDS           — default 49895,49897
 *   DIA_INICIO / DIA_FIM       — YYYY-MM-DD (default 2024-11-01 → hoje)
 *   DIA_SAIDA                  — CSV, default vendas-diarias.csv
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const hojeISO = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const INICIO = process.env.DIA_INICIO || "2024-11-01";
const FIM = process.env.DIA_FIM || hojeISO;
const SAIDA = process.env.DIA_SAIDA || "vendas-diarias.csv";

function dias(de, ate) {
  const out = [];
  let cur = de;
  while (cur <= ate) {
    out.push(cur);
    const d = new Date(`${cur}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cur = d.toISOString().slice(0, 10);
  }
  return out;
}

const paraBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function filtro(dia) {
  const br = paraBR(dia);
  return encodeURIComponent(
    JSON.stringify({
      start_date: br,
      end_date: br,
      exclude_canceled: 1,
      only_nfe: 0,
      id_store_shift: 0,
      id_sale_types: ["1", "2", "3", "4"],
      id_user_stores: null,
    }),
  );
}

async function main() {
  const lista = dias(INICIO, FIM);
  const s = await openSaiposSession();
  const dados = new Map(); // dia -> { [loja]: {total, vendas} }

  try {
    console.log(`[dia] ${s.storeIds.length} lojas x ${lista.length} dias (${INICIO} → ${FIM})`);
    let n = 0;
    for (const storeId of s.storeIds) {
      for (const dia of lista) {
        let total = 0;
        let vendas = 0;
        try {
          const rows = await s.get(storeId, `sales-by-payment-type?filter=${filtro(dia)}`);
          const arr = Array.isArray(rows) ? rows : [];
          total = arr.length ? Number(arr[0].total_saled) || 0 : 0;
          vendas = arr.length ? Number(arr[0].count_sales) || 0 : 0;
        } catch (e) {
          console.log(`  ! ${storeId} ${dia}: ${e.message.slice(0, 80)}`);
        }
        const cur = dados.get(dia) || {};
        cur[storeId] = { total, vendas };
        dados.set(dia, cur);
        n += 1;
        if (n % 100 === 0) console.log(`  ... ${n} consultas`);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  } finally {
    await s.close();
  }

  const lojas = s.storeIds;
  const linhas = [
    ["data", ...lojas.flatMap((l) => [`loja_${l}_total`, `loja_${l}_vendas`]), "total"].join(";"),
  ];
  for (const dia of dias(INICIO, FIM)) {
    const d = dados.get(dia) || {};
    const soma = lojas.reduce((a, l) => a + (d[l]?.total || 0), 0);
    linhas.push(
      [
        dia,
        ...lojas.flatMap((l) => [(d[l]?.total || 0).toFixed(2), d[l]?.vendas || 0]),
        soma.toFixed(2),
      ].join(";"),
    );
  }
  writeFileSync(SAIDA, linhas.join("\n") + "\n", "utf8");
  console.log(`\n[dia] CSV salvo em ${SAIDA} (${lista.length} dias)`);
}

main().catch((e) => {
  console.error("[dia] falhou:", e);
  process.exit(1);
});
