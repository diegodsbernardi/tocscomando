#!/usr/bin/env node
/**
 * Sonda dirigida ao recurso SALES do Saipos — o caminho pra venda item-a-item.
 *
 * O garimpo dos bundles revelou o resource real do app:
 *   GET /v1/stores/{id}/sales/{action}/{id_sale}
 *   · findAll               → action vazio, param from=clientweb
 *   · findById              → sales/{id_sale}
 *   · find-last-sale-by-store, get-sales-with-generic-items, sales-to-print
 *
 * Aqui a gente descobre (a) como filtrar a listagem por data e (b) se o detalhe
 * da venda traz os itens vendidos. Se trouxer, CMV real por prato deixa de estar
 * bloqueado. Somente GET.
 *
 * Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_STORE_IDS, SAIPOS_DATE (DD/MM/YYYY).
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

function defaultDateBR() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const [y, m, dd] = d.toISOString().slice(0, 10).split("-");
  return { br: `${dd}/${m}/${y}`, iso: d.toISOString().slice(0, 10) };
}

const DATE = process.env.SAIPOS_DATE
  ? { br: process.env.SAIPOS_DATE, iso: process.env.SAIPOS_DATE.split("/").reverse().join("-") }
  : defaultDateBR();

// Campos que não interessam ao objetivo e não precisam ir pro log.
const FILTER = encodeURIComponent(
  JSON.stringify({
    start_date: DATE.br,
    end_date: DATE.br,
    exclude_canceled: 1,
    only_nfe: 0,
    id_store_shift: 0,
    id_sale_types: ["1", "2", "3", "4"],
    id_user_stores: null,
  })
);

const PRIVATE = /(customer|client|phone|fone|cpf|cnpj|address|endereco|street|complement|email|name_receiver)/i;

function redact(obj) {
  if (Array.isArray(obj)) return obj.map(redact);
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PRIVATE.test(k) ? "«omitido»" : typeof v === "object" ? redact(v) : v;
  }
  return out;
}

/** Procura, em qualquer profundidade, arrays que pareçam "itens da venda". */
function findItemArrays(obj, path = "$", acc = []) {
  if (Array.isArray(obj)) {
    if (obj.length && typeof obj[0] === "object" && obj[0]) {
      const keys = Object.keys(obj[0]);
      if (keys.some((k) => /item|product|produt/i.test(k))) {
        acc.push({ path, len: obj.length, keys });
      }
    }
    obj.slice(0, 3).forEach((v, i) => findItemArrays(v, `${path}[${i}]`, acc));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) findItemArrays(v, `${path}.${k}`, acc);
  }
  return acc;
}

async function tryGet(s, storeId, path) {
  const url = `https://api.saipos.com/v1/stores/${storeId}/${path}`;
  try {
    const res = await s.page.request.get(url, {
      headers: { authorization: s.authHeader },
      timeout: 30000,
    });
    const text = await res.text();
    if (!res.ok()) return { path, status: res.status(), ok: false, body: text.slice(0, 200) };
    try {
      return { path, status: 200, ok: true, json: JSON.parse(text) };
    } catch {
      return { path, status: 200, ok: false, body: "(resposta não-JSON)" };
    }
  } catch (e) {
    return { path, status: "ERR", ok: false, body: e.message };
  }
}

function describe(r) {
  if (!r.ok) return `✗ ${r.status} ${String(r.body).slice(0, 110)}`;
  const j = r.json;
  if (Array.isArray(j)) {
    return `✓ 200 array[${j.length}]${j.length ? ` keys=${Object.keys(j[0]).slice(0, 14).join(",")}` : ""}`;
  }
  return `✓ 200 obj keys=${Object.keys(j || {}).slice(0, 14).join(",")}`;
}

async function main() {
  const s = await openSaiposSession();
  const out = { date: DATE, tries: [] };
  try {
    const storeId = s.storeIds[0];
    const d = DATE.br;
    const di = DATE.iso;
    console.log(`[sales] loja ${storeId} · data ${d}\n`);

    // 1) Como listar as vendas do dia? Testa os dialetos de filtro plausíveis.
    const listVariants = [
      `sales?from=clientweb`,
      `sales?from=clientweb&start_date=${encodeURIComponent(d)}&end_date=${encodeURIComponent(d)}`,
      `sales?from=clientweb&initial_date=${encodeURIComponent(d)}&final_date=${encodeURIComponent(d)}`,
      `sales?from=clientweb&date=${encodeURIComponent(d)}`,
      `sales?from=clientweb&start_date=${di}&end_date=${di}`,
      `sales?from=clientweb&filter=${encodeURIComponent(JSON.stringify({ start_date: d, end_date: d, exclude_canceled: 1 }))}`,
      `sales/find-last-sale-by-store`,
      `sales/get-sales-with-generic-items`,
      // Nomes reais dos relatórios, lidos do menu do app (StoreItemSoldController).
      `store-item-sold?filter=${FILTER}`,
      `consumed-ingredients?filter=${FILTER}`,
      `find-consumed-ingredients?filter=${FILTER}`,
      `sales-by-period?filter=${FILTER}`,
      `sales-by-payment-type-by-day?filter=${FILTER}`,
      // O resource de relatórios usa camelCase aqui — por isso nenhum chute pegou.
      `itemsSold?filter=${FILTER}`,
      `revenue-per-day?filter=${FILTER}`,
      `sales-total-daily?filter=${FILTER}`,
    ];

    let sample = null; // primeira venda que aparecer, pra puxar o detalhe
    for (const v of listVariants) {
      const r = await tryGet(s, storeId, v);
      out.tries.push({ path: v, status: r.status, ok: r.ok, shape: describe(r) });
      console.log(`  ${describe(r)}   ← ${v.split("?")[0]}${v.includes("?") ? "?" + v.split("?")[1].slice(0, 60) : ""}`);
      if (r.ok) {
        // guarda uma amostra dos relatórios (é o que interessa pro CMV por prato)
        if (/^(itemsSold|revenue-per-day|sales-total-daily)/.test(v)) {
          const j = r.json;
          out.samples = out.samples || {};
          out.samples[v.split("?")[0]] = JSON.parse(
            JSON.stringify(j, (k, val) => (Array.isArray(val) ? val.slice(0, 5) : val))
          );
          for (const [key, val] of Object.entries(j || {})) {
            if (Array.isArray(val)) {
              console.log(`      ↳ ${key}: ${val.length} linha(s)${val.length ? ` keys=${Object.keys(val[0]).join(",")}` : ""}`);
              if (val.length) console.log(`         ex: ${JSON.stringify(val[0]).slice(0, 300)}`);
            }
          }
        }
        const arr = Array.isArray(r.json) ? r.json : r.json ? [r.json] : [];
        if (arr.length && !sample) sample = arr[0];
        // já dá pra ver se a listagem traz itens embutidos
        const inline = findItemArrays(arr.slice(0, 2));
        if (inline.length) {
          console.log(`      ↳ itens embutidos na listagem: ${inline.map((i) => `${i.path} (${i.len}) keys=${i.keys.slice(0, 8).join(",")}`).join(" | ")}`);
        }
      }
    }

    // 2) Detalhe da venda: é aqui que os itens costumam estar.
    const saleId = sample?.id_sale ?? sample?.id ?? null;
    if (saleId) {
      console.log(`\n[sales] detalhe da venda ${saleId}`);
      const det = await tryGet(s, storeId, `sales/${saleId}`);
      out.detail = { status: det.status, ok: det.ok };
      console.log(`  ${describe(det)}`);
      if (det.ok) {
        const arrays = findItemArrays(det.json);
        if (arrays.length) {
          console.log(`  🎯 ARRAYS DE ITEM ENCONTRADOS:`);
          arrays.forEach((a) => console.log(`     ${a.path} → ${a.len} item(ns) · keys=${a.keys.join(",")}`));
        } else {
          console.log(`  nenhum array com cara de item no detalhe.`);
        }
        out.detail.sample = redact(det.json);
      }
    } else {
      console.log(`\n[sales] nenhuma venda retornada — não deu pra testar o detalhe.`);
    }

    writeFileSync("saipos-sales-probe.json", JSON.stringify(redact(out), null, 2));
    console.log(`\n[sales] relatório em saipos-sales-probe.json (dados de cliente omitidos)`);
  } catch (e) {
    console.error("[sales] falhou:", e.message);
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
