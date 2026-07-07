#!/usr/bin/env node
/**
 * Comando: ITENS SEM FICHA TÉCNICA (Saipos) — camada 3 (agente) mínima.
 *
 * Puxa os produtos (/items) e insumos (/ingredients) via API do Saipos e
 * lista os itens que estão SEM ficha técnica preenchida.
 *
 * Um item TEM ficha quando:
 *   - alguma variação traz ingredientes (variations[].ingredients não vazio), OU
 *   - é montável e alguma escolha aponta insumo
 *     (choices[].choice.choice_items[].id_store_ingredient).
 * Caso contrário, está SEM ficha.
 *
 * Saída: itens-sem-ficha.md (artifact) + resumo no log. Somente leitura.
 * Env: ver scripts/lib/saipos_session.mjs. SAIPOS_INCLUDE_DISABLED=1 inclui inativos.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const INCLUDE_DISABLED = process.env.SAIPOS_INCLUDE_DISABLED === "1";

// Percorre variações e conta ingredientes da ficha direta.
function directRecipe(item) {
  const vars = item.variations || [];
  let total = 0;
  for (const v of vars) total += (v.ingredients || []).length;
  return total;
}

// Conta insumos referenciados em montáveis (choices), no item ou nas variações.
function choiceRecipe(item) {
  const buckets = [];
  if (Array.isArray(item.choices)) buckets.push(...item.choices);
  for (const v of item.variations || []) {
    if (Array.isArray(v.choices)) buckets.push(...v.choices);
  }
  let total = 0;
  for (const c of buckets) {
    const cis = c?.choice?.choice_items || c?.choice_items || [];
    for (const ci of cis) if (ci?.id_store_ingredient) total++;
  }
  return total;
}

function classify(item) {
  const direct = directRecipe(item);
  const choice = choiceRecipe(item);
  if (direct > 0) return { status: "ficha", via: "ingredientes", count: direct };
  if (choice > 0) return { status: "ficha", via: "montável", count: choice };
  return { status: "sem_ficha", via: "-", count: 0 };
}

async function analyzeStore(s, storeId) {
  const items = await s.get(storeId, "items");
  let ingredients = [];
  try {
    ingredients = await s.get(storeId, "ingredients");
  } catch (e) {
    console.warn(`[ficha] loja ${storeId}: sem insumos (${e.message})`);
  }
  const ingNames = new Map(
    ingredients.map((i) => [i.id_store_ingredient, i.desc_store_ingredient])
  );

  const rows = [];
  for (const it of items) {
    const enabled = it.enabled === "Y";
    if (!enabled && !INCLUDE_DISABLED) continue;
    const c = classify(it);
    rows.push({
      id: it.id_store_item,
      nome: it.desc_store_item,
      tipo: it.item_type,
      enabled,
      ...c,
    });
  }
  return { storeId, total: items.length, insumos: ingredients.length, rows };
}

function renderStore(store) {
  const sem = store.rows.filter((r) => r.status === "sem_ficha");
  const com = store.rows.filter((r) => r.status === "ficha");
  const lines = [];
  lines.push(`## Loja ${store.storeId}`);
  lines.push(
    `${store.rows.length} itens analisados · **${sem.length} SEM ficha** · ${com.length} com ficha · ${store.insumos} insumos cadastrados`
  );
  lines.push("");
  lines.push(`### ❌ Sem ficha técnica (${sem.length})`);
  if (sem.length === 0) {
    lines.push("_Todos os itens têm ficha. 🎉_");
  } else {
    lines.push("| Item | Tipo | Ativo |");
    lines.push("|---|---|---|");
    for (const r of sem.sort((a, b) => a.nome.localeCompare(b.nome))) {
      lines.push(`| ${r.nome} | ${r.tipo || "-"} | ${r.enabled ? "sim" : "não"} |`);
    }
  }
  lines.push("");
  lines.push(`<details><summary>✅ Com ficha (${com.length})</summary>`);
  lines.push("");
  lines.push("| Item | Via | Nº insumos |");
  lines.push("|---|---|---|");
  for (const r of com.sort((a, b) => a.nome.localeCompare(b.nome))) {
    lines.push(`| ${r.nome} | ${r.via} | ${r.count} |`);
  }
  lines.push("</details>");
  lines.push("");
  return { md: lines.join("\n"), sem: sem.length, com: com.length };
}

async function main() {
  const s = await openSaiposSession();
  try {
    const parts = [`# Itens sem ficha técnica — Saipos`, `Gerado via API interna (somente leitura).`, ""];
    let totalSem = 0;
    console.log("");
    for (const storeId of s.storeIds) {
      let store;
      try {
        store = await analyzeStore(s, storeId);
      } catch (e) {
        console.warn(`[ficha] loja ${storeId} falhou: ${e.message} — pulando`);
        parts.push(`## Loja ${storeId}\n_Falhou: ${e.message}_\n`);
        continue;
      }
      const r = renderStore(store);
      totalSem += r.sem;
      parts.push(r.md);
      console.log(
        `[ficha] loja ${storeId}: ${store.rows.length} itens → ${r.sem} SEM ficha, ${r.com} com ficha`
      );
      // resumo legível no log
      store.rows
        .filter((x) => x.status === "sem_ficha")
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .forEach((x) => console.log(`   ❌ ${x.nome} (${x.tipo})`));
    }
    writeFileSync("itens-sem-ficha.md", parts.join("\n"));
    console.log(`\n[ficha] relatório salvo em itens-sem-ficha.md — total ${totalSem} itens sem ficha`);
  } catch (e) {
    console.error("[ficha] falhou:", e.message);
    process.exit(1);
  } finally {
    await s.close();
  }
}

main();
