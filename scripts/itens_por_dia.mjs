#!/usr/bin/env node
/**
 * Itens vendidos DIA A DIA por loja — para medir efeito de promoção por dia
 * da semana (ex: o Vintão da terça: puxa acompanhamento ou só troca de item?).
 *
 * itemsSold aceita janela livre, então uma chamada por loja por dia.
 *
 * Só leitura. Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_STORE_IDS,
 *                  DIA_INI / DIA_FIM (YYYY-MM-DD).
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const INI = process.env.DIA_INI || "2026-03-01";
const FIM = process.env.DIA_FIM ||
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const num = (v) => Number(String(v ?? 0).replace(",", ".")) || 0;

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
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function main() {
  const lista = dias(INI, FIM);
  const s = await openSaiposSession();
  const linhas = [];
  try {
    console.log(`[dia] ${s.storeIds.length} lojas x ${lista.length} dias`);
    let n = 0;
    for (const storeId of s.storeIds) {
      for (const dia of lista) {
        const f = encodeURIComponent(JSON.stringify({
          start_date: br(dia), end_date: br(dia), exclude_canceled: 1, only_nfe: 0,
          id_store_shift: 0, id_sale_types: ["1", "2", "3", "4"], id_user_stores: null,
        }));
        try {
          const j = await s.get(storeId, `itemsSold?filter=${f}`);
          for (const i of j?.items || []) {
            linhas.push([storeId, dia, String(i.desc_item).replace(/;/g, ","), num(i.total_qtt), num(i.total_value).toFixed(2)]);
          }
        } catch (e) {
          console.log(`  ! ${storeId} ${dia}: ${e.message.slice(0, 70)}`);
        }
        if (++n % 60 === 0) console.log(`  ... ${n}/${lista.length * s.storeIds.length}`);
        await new Promise((r) => setTimeout(r, 220));
      }
    }
  } finally {
    await s.close();
  }
  writeFileSync("itens-por-dia.csv",
    ["loja;data;item;qtd;valor"].concat(linhas.map((l) => l.join(";"))).join("\n") + "\n", "utf8");
  console.log(`[dia] itens-por-dia.csv: ${linhas.length} linhas`);
}

main().catch((e) => { console.error("[dia] falhou:", e); process.exit(1); });
