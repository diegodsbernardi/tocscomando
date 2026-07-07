#!/usr/bin/env node
/**
 * Verificação pontual: a ficha técnica vem na LISTAGEM (/items) ou só no
 * DETALHE de cada item? Resolve o "0 fichas na loja 49895" (real x bug).
 *
 * Pega alguns itens que deveriam ter ficha (hambúrgueres) na 1ª loja e
 * compara ingredientes na listagem vs no detalhe (tenta padrões de URL).
 * Somente leitura. Env: ver scripts/lib/saipos_session.mjs.
 * SAIPOS_VERIFY_NAMES: nomes separados por ; (default hambúrgueres do TOCS).
 */

import { openSaiposSession } from "./lib/saipos_session.mjs";

const NAMES = (process.env.SAIPOS_VERIFY_NAMES || "DBS;Simples;Duplo;Triplo;Mussarelo;Galactocs")
  .split(";")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const DETAIL_PATTERNS = [
  (id) => `items/${id}`,
  (id) => `items/${id}/ingredients`,
  (id) => `store-items/${id}`,
  (id) => `items/${id}/detail`,
  (id) => `menu/items/${id}`,
];

function countIngredients(item) {
  let n = 0;
  for (const v of item.variations || []) n += (v.ingredients || []).length;
  return n;
}

async function tryDetail(s, storeId, id) {
  for (const pat of DETAIL_PATTERNS) {
    const path = pat(id);
    try {
      const json = await s.get(storeId, path);
      // pode vir objeto (item) ou array (ingredientes)
      let ing = null;
      if (Array.isArray(json)) ing = json.length;
      else if (json && typeof json === "object") ing = countIngredients(json);
      return { path, ok: true, ing, keys: Array.isArray(json) ? "(array)" : Object.keys(json || {}).slice(0, 10).join(",") };
    } catch (e) {
      // 404/500 → tenta o próximo padrão
    }
  }
  return { path: "(nenhum padrão funcionou)", ok: false };
}

async function main() {
  const s = await openSaiposSession();
  try {
    const storeId = s.storeIds[0];
    console.log(`[verify] loja ${storeId}: baixando listagem de itens...`);
    const items = await s.get(storeId, "items");
    const picks = items.filter((it) =>
      NAMES.some((n) => (it.desc_store_item || "").toLowerCase().includes(n))
    );
    console.log(`[verify] ${picks.length} item(ns) candidato(s) encontrado(s)\n`);

    for (const it of picks.slice(0, 6)) {
      const listCount = countIngredients(it);
      const detail = await tryDetail(s, storeId, it.id_store_item);
      console.log(`# ${it.desc_store_item} (id ${it.id_store_item})`);
      console.log(`   listagem /items → ${listCount} ingrediente(s)`);
      if (detail.ok) {
        console.log(`   detalhe ${detail.path} → ${detail.ing} ingrediente(s)  [keys: ${detail.keys}]`);
        if (listCount === 0 && detail.ing > 0) console.log(`   ⚠️  BUG: ficha só vem no detalhe!`);
        if (listCount === 0 && detail.ing === 0) console.log(`   ✅ confirmado SEM ficha (vazio nos dois)`);
      } else {
        console.log(`   detalhe → nenhum endpoint de item respondeu`);
      }
      console.log("");
    }
  } catch (e) {
    console.error("[verify] falhou:", e.message);
    process.exit(1);
  } finally {
    await s.close();
  }
}

main();
