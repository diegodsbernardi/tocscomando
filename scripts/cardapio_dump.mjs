#!/usr/bin/env node
/**
 * Despejo do cardápio + vendas por item — matéria-prima da engenharia de
 * cardápio (matriz BCG).
 *
 * Salva três coisas:
 *   items.json        → produtos com grupo, preço e ficha técnica
 *   ingredients.json  → insumos com custo (o que permite calcular margem)
 *   vendas-item.csv   → itemsSold mês a mês por loja (volume e receita)
 *
 * A análise é feita depois, em cima desses arquivos — assim uma mudança de
 * critério não exige outra passada no Saipos.
 *
 * Só leitura. Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_STORE_IDS,
 *                  CARD_INICIO / CARD_FIM (YYYY-MM).
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const INICIO = process.env.CARD_INICIO || "2025-09";
const FIM =
  process.env.CARD_FIM ||
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);

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
    const loja0 = s.storeIds[0];

    // Cardápio e insumos vêm de uma loja só — o catálogo é compartilhado.
    for (const [path, arquivo] of [["items", "items.json"], ["ingredients", "ingredients.json"]]) {
      try {
        const j = await s.get(loja0, path);
        const arr = Array.isArray(j) ? j : j?.rows || [];
        writeFileSync(arquivo, JSON.stringify(arr), "utf8");
        console.log(`[card] ${path}: ${arr.length} registro(s) → ${arquivo}`);
        if (arr[0]) console.log(`   campos: ${Object.keys(arr[0]).slice(0, 22).join(", ")}`);
      } catch (e) {
        console.log(`[card] ${path} falhou: ${e.message.slice(0, 100)}`);
        writeFileSync(arquivo, "[]", "utf8");
      }
    }

    // Vendas por item, mês a mês, por loja.
    for (const storeId of s.storeIds) {
      for (const ym of lista) {
        const { start, end } = janela(ym);
        const f = encodeURIComponent(
          JSON.stringify({
            start_date: start, end_date: end, exclude_canceled: 1, only_nfe: 0,
            id_store_shift: 0, id_sale_types: ["1", "2", "3", "4"], id_user_stores: null,
          }),
        );
        try {
          const j = await s.get(storeId, `itemsSold?filter=${f}`);
          const itens = j?.items || [];
          for (const i of itens) {
            linhas.push({
              loja: storeId, mes: ym,
              item: i.desc_item,
              codigo: i.identifier_number ?? "",
              qtd: num(i.total_qtt),
              valor: num(i.total_value),
            });
          }
          console.log(`[card] loja ${storeId} · ${ym} · ${itens.length} itens`);
        } catch (e) {
          console.log(`[card] loja ${storeId} · ${ym} · ERRO ${e.message.slice(0, 80)}`);
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  } finally {
    await s.close();
  }

  const csv = ["loja;mes;item;codigo;qtd;valor"];
  for (const l of linhas) {
    csv.push(`${l.loja};${l.mes};${String(l.item).replace(/;/g, ",")};${l.codigo};${l.qtd};${l.valor.toFixed(2)}`);
  }
  writeFileSync("vendas-item.csv", csv.join("\n") + "\n", "utf8");
  console.log(`[card] vendas-item.csv: ${linhas.length} linhas`);
}

main().catch((e) => {
  console.error("[card] falhou:", e);
  process.exit(1);
});
