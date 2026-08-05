#!/usr/bin/env node
/**
 * Conferência: por que a soma dos itens vendidos ≠ total do caixa?
 *
 * Cruza, para uma data e uma loja, as três visões do Saipos:
 *   1. itemsSold             → soma do valor dos itens (valor de menu)
 *   2. sales-by-period       → venda a venda, com total_discount / total_increase /
 *                              total_service_charge_amount / delivery fee
 *   3. sales-by-payment-type → o que efetivamente entrou por forma de pagamento
 *
 * E tenta fechar a conta: itens − descontos + acréscimos + taxas = caixa?
 *
 * `sales-by-period` exige paginação no filtro (rows_per_page / rownum_initial) —
 * sem isso o backend devolve 500. Somente GET.
 *
 * Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_DATE (DD/MM/YYYY), SAIPOS_STORE_IDS.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

function defaultDateBR() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const [y, m, dd] = d.toISOString().slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
}

const DATE = process.env.SAIPOS_DATE || defaultDateBR();

const baseFilter = {
  start_date: DATE,
  end_date: DATE,
  exclude_canceled: 1,
  only_nfe: 0,
  id_store_shift: 0,
  id_sale_types: ["1", "2", "3", "4"],
  id_user_stores: null,
};

const enc = (o) => encodeURIComponent(JSON.stringify(o));
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => Number(String(v ?? 0).replace(",", ".")) || 0;
const sum = (rows, f) => rows.reduce((a, r) => a + num(f(r)), 0);

async function getSalesByPeriod(s, storeId) {
  // Paginação: o backend espera rows_per_page e rownum_initial (1-based).
  const rows = [];
  let rownum = 1;
  const perPage = 500;
  for (let page = 0; page < 20; page++) {
    const filter = { ...baseFilter, rows_per_page: perPage, rownum_initial: rownum };
    const json = await s.get(storeId, `sales-by-period?filter=${enc(filter)}`);
    const batch = json?.rows || (Array.isArray(json) ? json : []);
    rows.push(...batch);
    const total = num(json?.total);
    if (!batch.length || rows.length >= total) break;
    rownum += perPage;
  }
  return rows;
}

async function main() {
  const s = await openSaiposSession();
  const out = { date: DATE, stores: {} };
  try {
    for (const storeId of s.storeIds) {
      console.log(`\n${"=".repeat(60)}\n[conf] loja ${storeId} · ${DATE}\n${"=".repeat(60)}`);

      // 1) itens vendidos
      let itemsTotal = 0;
      try {
        const j = await s.get(storeId, `itemsSold?filter=${enc(baseFilter)}`);
        itemsTotal = sum(j?.items || [], (r) => r.total_value);
        console.log(`  itens vendidos ............. ${brl(itemsTotal)}  (${(j?.items || []).length} produtos)`);
      } catch (e) {
        console.warn(`  itemsSold falhou: ${e.message}`);
      }

      // 2) caixa por forma de pagamento
      let caixa = 0;
      try {
        const j = await s.get(storeId, `sales-by-payment-type?filter=${enc(baseFilter)}`);
        caixa = j.length ? num(j[0].total_saled) : 0;
        console.log(`  caixa (total_saled) ........ ${brl(caixa)}  (${j.length ? j[0].count_sales : 0} vendas)`);
      } catch (e) {
        console.warn(`  sales-by-payment-type falhou: ${e.message}`);
      }

      // 3) venda a venda
      let sales = [];
      try {
        sales = await getSalesByPeriod(s, storeId);
      } catch (e) {
        console.warn(`  sales-by-period falhou: ${e.message}`);
      }

      if (!sales.length) {
        console.log(`  sales-by-period não devolveu linhas — sem como decompor.`);
        out.stores[storeId] = { itemsTotal, caixa };
        continue;
      }

      // Descobre os campos de dinheiro que existem de fato na resposta.
      const keys = Object.keys(sales[0]);
      const moneyKeys = keys.filter((k) => /amount|total|value|discount|increase|charge|fee|frete|delivery|taxa|service/i.test(k));
      console.log(`\n  ${sales.length} venda(s) · campos de valor: ${moneyKeys.join(", ")}\n`);
      const totals = {};
      for (const k of moneyKeys) totals[k] = sum(sales, (r) => r[k]);
      for (const [k, v] of Object.entries(totals)) {
        if (v !== 0) console.log(`    ${k.padEnd(34)} ${brl(v).padStart(14)}`);
      }

      // Tenta fechar a conta com os campos que existirem.
      const desc = totals.total_discount || 0;
      const incr = totals.total_increase || 0;
      const serv = totals.total_service_charge_amount || 0;
      const conta = itemsTotal - desc + incr + serv;
      console.log(`\n  itens ${brl(itemsTotal)} − desconto ${brl(desc)} + acréscimo ${brl(incr)} + serviço ${brl(serv)}`);
      console.log(`  = ${brl(conta)}   vs caixa ${brl(caixa)}   → sobra ${brl(conta - caixa)}`);

      // Se ainda sobrar, mostra as vendas com maior desconto/divergência.
      const comDesconto = sales.filter((r) => num(r.total_discount) > 0);
      if (comDesconto.length) {
        console.log(`\n  ${comDesconto.length} venda(s) com desconto:`);
        comDesconto
          .sort((a, b) => num(b.total_discount) - num(a.total_discount))
          .slice(0, 10)
          .forEach((r) =>
            console.log(
              `    #${r.id_sale} ${brl(r.total_amount)} − ${brl(r.total_discount)}  motivo: ${r.discount_reason || "(sem motivo)"}`
            )
          );
      }

      out.stores[storeId] = { itemsTotal, caixa, totals, sales_count: sales.length };
    }
    writeFileSync("saipos-conferencia.json", JSON.stringify(out, null, 2));
    console.log(`\n[conf] detalhe em saipos-conferencia.json`);
  } catch (e) {
    console.error("[conf] falhou:", e.message);
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
