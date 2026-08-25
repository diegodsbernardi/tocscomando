#!/usr/bin/env node
/**
 * Formas de pagamento por mês/loja — para achar a origem de desconto
 * estrutural (clube, cupom, parceiro) e desde quando ele roda.
 *
 * sales-by-payment-type aceita janela livre e devolve uma linha por forma de
 * pagamento com valor e contagem. Se um clube de desconto entra como forma de
 * pagamento ou voucher, ele aparece aqui mês a mês.
 *
 * Só leitura. Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_STORE_IDS,
 *                  PAG_INICIO / PAG_FIM (YYYY-MM), PAG_SAIDA.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const INICIO = process.env.PAG_INICIO || "2025-05";
const FIM =
  process.env.PAG_FIM ||
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);
const SAIDA = process.env.PAG_SAIDA || "pagamentos-mensais.csv";

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

function janela(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `01/${mm}/${y}`, end: `${ultimo}/${mm}/${y}` };
}

async function main() {
  const lista = meses(INICIO, FIM);
  const s = await openSaiposSession();
  const linhas = [];

  try {
    for (const storeId of s.storeIds) {
      console.log(`\n===== LOJA ${storeId} =====`);
      for (const ym of lista) {
        const { start, end } = janela(ym);
        const f = encodeURIComponent(
          JSON.stringify({
            start_date: start,
            end_date: end,
            exclude_canceled: 1,
            only_nfe: 0,
            id_store_shift: 0,
            id_sale_types: ["1", "2", "3", "4"],
            id_user_stores: null,
          }),
        );
        try {
          const rows = await s.get(storeId, `sales-by-payment-type?filter=${f}`);
          const arr = Array.isArray(rows) ? rows : [];
          console.log(`\n  ${ym} · ${arr.length} formas de pagamento`);
          for (const r of arr.sort((a, b) => num(b.total_value) - num(a.total_value))) {
            const nome = r.desc_store_payment_type || "(sem nome)";
            console.log(`     ${nome.padEnd(34)} ${brl(num(r.total_value)).padStart(13)} · ${String(num(r.count_payments)).padStart(5)}x`);
            linhas.push({
              storeId, ym, forma: nome,
              valor: num(r.total_value), qtd: num(r.count_payments),
            });
          }
        } catch (e) {
          console.log(`  ${ym} · ERRO ${e.message.slice(0, 90)}`);
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } finally {
    await s.close();
  }

  const csv = ["loja;mes;forma_pagamento;valor;qtd"];
  for (const l of linhas) csv.push(`${l.storeId};${l.ym};${l.forma};${l.valor.toFixed(2)};${l.qtd}`);
  writeFileSync(SAIDA, csv.join("\n") + "\n", "utf8");
  console.log(`\n[pag] CSV salvo em ${SAIDA}`);
}

main().catch((e) => {
  console.error("[pag] falhou:", e);
  process.exit(1);
});
