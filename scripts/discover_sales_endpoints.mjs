#!/usr/bin/env node
/**
 * ESPIÃO v2 — caça ao endpoint de VENDA ITEM-A-ITEM do Saipos. Somente leitura.
 *
 * O espião v1 (discover_saipos.mjs) chutava nomes de endpoint e só acertou
 * items/ingredients/sales-by-payment-type. Aqui a lógica é outra: o front do
 * Saipos é um app JS, então TODA rota da API está escrita nos bundles dele.
 * Em vez de adivinhar, a gente lê o código do app.
 *
 * Fases:
 *   1. BUNDLE  — baixa os .js carregados pelo app e extrai literais que
 *                pareçam path de API (com foco em venda/produto/relatório).
 *   2. PASSIVO — registra as URLs que o app chama sozinho após o login.
 *   3. SONDA   — GET em cada candidato (com e sem ?filter=), na loja ativa.
 *                Marca como PROMISSOR o que responder 200 com corpo não-vazio.
 *
 * Nunca faz POST/PUT/DELETE. Não escreve no Supabase.
 *
 * Env: SAIPOS_USER, SAIPOS_PASS (obrigatórias), SAIPOS_STORE_IDS,
 *      SAIPOS_DATE (DD/MM/YYYY, default ontem — dia com movimento fechado),
 *      SAIPOS_MAX_PROBES (default 120).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const MAX_PROBES = Number(process.env.SAIPOS_MAX_PROBES || 120);
const DUMP = process.env.SAIPOS_DUMP_BUNDLES !== "0"; // guarda os bundles do app como artifact

// Ontem no fuso de SP: dia fechado, garante movimento no relatório.
function defaultDateBR() {
  const now = new Date();
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const [y, m, dd] = d.toISOString().slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
}

const DATE = process.env.SAIPOS_DATE || defaultDateBR();

// Mesmo formato de filtro que o sales-by-payment-type aceita (âncora conhecida).
const FILTER = encodeURIComponent(
  JSON.stringify({
    start_date: DATE,
    end_date: DATE,
    exclude_canceled: 1,
    only_nfe: 0,
    id_store_shift: 0,
    id_sale_types: ["1", "2", "3", "4"],
    id_user_stores: null,
  })
);

// Palavras que indicam "isso pode ser venda por produto".
const HOT = /(sale|sold|venda|product|produt|item|abc|rank|best|top|curve|curva|order|pedido|ticket|invoice|report|relatorio|analytic|dashboard|cmv|mix)/i;
// Ruído óbvio: assets, i18n, libs.
const NOISE = /(\.(js|css|png|jpg|svg|woff|json|html|map)$|^https?:|node_modules|assets\/|i18n|translat|template|\.min$)/i;

/** Extrai de um bundle JS os literais que parecem path de API REST. */
function extractPaths(source) {
  const found = new Set();
  // 1) qualquer literal de string plausível como path
  const strLit = /["'`]([a-z][a-z0-9_\-]*(?:\/[a-z0-9_\-{}$:]+)*)["'`]/gi;
  let m;
  while ((m = strLit.exec(source))) {
    const p = m[1];
    if (p.length < 4 || p.length > 70) continue;
    if (NOISE.test(p)) continue;
    if (!HOT.test(p)) continue;
    found.add(p.replace(/^\/+/, ""));
  }
  // 2) literais que já trazem o prefixo stores/ (mais confiável)
  const storeLit = /stores\/[^"'`\s]{0,40}?\/([a-z0-9_\-\/]{3,50})/gi;
  while ((m = storeLit.exec(source))) {
    const p = m[1];
    if (NOISE.test(p)) continue;
    found.add(p);
  }
  return found;
}

/** Candidatos de alta probabilidade, no dialeto que o app realmente usa. */
function handPicked() {
  return [
    // snake_case (convenção vista nas chamadas passivas)
    "sales",
    "sale_items",
    "sales_items",
    "store_items_sold",
    "sales_by_item",
    "sales_by_product",
    "items_sold",
    "products_sold",
    "sale_products",
    "abc_curve",
    "curve_abc",
    // kebab-case (dialeto do sales-by-payment-type)
    "sales-by-item",
    "sales-by-product",
    "sales-by-store-item",
    "sales-by-item-category",
    "sold-items",
    "items-sold",
    "abc-curve",
    "sales-detailed",
    "sales-by-sale-type",
    "sales-analytic",
    "sales-synthetic",
    // relatórios agrupados
    "reports/sales-by-item",
    "reports/sales-by-product",
    "reports/abc-curve",
    "reports/items-sold",
  ];
}

async function probe(s, storeId, path) {
  const attempts = path.includes("?")
    ? [path]
    : [`${path}?filter=${FILTER}`, path];
  for (const attempt of attempts) {
    const url = `https://api.saipos.com/v1/stores/${storeId}/${attempt}`;
    try {
      const res = await s.page.request.get(url, {
        headers: { authorization: s.authHeader },
        timeout: 20000,
      });
      if (!res.ok()) {
        // 400 costuma significar "existe mas o filtro está errado" — vale registrar.
        if (res.status() === 400) {
          return {
            path,
            tried: attempt,
            status: 400,
            ok: false,
            note: (await res.text()).slice(0, 200),
          };
        }
        continue;
      }
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        continue; // HTML/redirect não interessa
      }
      const isArr = Array.isArray(json);
      const count = isArr ? json.length : null;
      const keys = isArr
        ? json.length
          ? Object.keys(json[0])
          : []
        : Object.keys(json || {});
      return {
        path,
        tried: attempt,
        status: 200,
        ok: true,
        count,
        keys,
        sample: isArr ? json.slice(0, 2) : json,
      };
    } catch {
      // timeout/erro de rede → tenta a próxima variação
    }
  }
  return { path, status: 404, ok: false };
}

async function main() {
  const s = await openSaiposSession();
  const report = { date: DATE, bundles: [], passive: [], candidates: [], probes: [] };

  // PASSIVO: o login já aconteceu dentro do openSaiposSession, então aqui só
  // pegamos as chamadas que o app fizer daqui pra frente (bônus, não a aposta).
  const observed = new Set();
  s.page.on("request", (req) => {
    const u = req.url();
    if (u.includes("api.saipos.com")) observed.add(`${req.method()} ${u.split("?")[0]}`);
  });

  try {
    const storeId = s.storeIds[0];

    // --- Fase 1: bundles ---
    const scriptUrls = await s.page.evaluate(() =>
      Array.from(document.querySelectorAll("script[src]")).map((el) => el.src)
    );
    console.log(`[v2] ${scriptUrls.length} bundle(s) referenciados na página`);

    const fromBundles = new Set();
    for (const url of scriptUrls) {
      try {
        const res = await s.page.request.get(url, { timeout: 30000 });
        if (!res.ok()) continue;
        const body = await res.text();
        // Guarda os bundles do app (não os de terceiros) pra análise offline:
        // o hash é estável, então dá pra garimpar rota sem gastar run.
        const file = url.split("/").pop().split("?")[0];
        if (DUMP && /^(main|vendors|modules|core|runtime)\./.test(file)) {
          mkdirSync("bundles", { recursive: true });
          writeFileSync(`bundles/${file}`, body);
        }
        const paths = extractPaths(body);
        report.bundles.push({ url, bytes: body.length, hits: paths.size });
        console.log(`[v2]   ${paths.size.toString().padStart(4)} candidatos · ${Math.round(body.length / 1024)}KB · ${url.split("/").pop()}`);
        paths.forEach((p) => fromBundles.add(p));
      } catch (e) {
        console.warn(`[v2]   falhou ao baixar ${url}: ${e.message}`);
      }
    }

    // --- Fase 2: passivo ---
    report.passive = Array.from(observed).sort();

    // --- Fase 3: sonda ---
    const candidates = Array.from(new Set([...handPicked(), ...fromBundles]))
      .filter((p) => !p.startsWith("v1/"))
      .sort((a, b) => {
        // prioriza o que cheira a venda por item
        const score = (x) => (/(item|product|produt|abc|sold|curve)/i.test(x) ? 0 : 1);
        return score(a) - score(b) || a.localeCompare(b);
      })
      .slice(0, MAX_PROBES);
    report.candidates = candidates;
    console.log(`\n[v2] sondando ${candidates.length} candidato(s) na loja ${storeId} (data ${DATE}, só GET)\n`);

    const hits = [];
    for (const p of candidates) {
      const r = await probe(s, storeId, p);
      report.probes.push(r);
      if (r.ok) {
        const shape = r.count != null ? `array[${r.count}]` : "obj";
        const keys = (r.keys || []).slice(0, 10).join(",");
        console.log(`  ✓ 200  ${p}  ${shape} keys=${keys}`);
        if (r.count === null || r.count > 0) hits.push(r);
      } else if (r.status === 400) {
        console.log(`  ~ 400  ${p}  (existe? filtro rejeitado: ${(r.note || "").slice(0, 80)})`);
        hits.push(r);
      }
    }

    writeFileSync("saipos-endpoints.json", JSON.stringify(report, null, 2));

    console.log(`\n[v2] ===== RESUMO =====`);
    const itemish = hits.filter(
      (h) => h.ok && (h.keys || []).some((k) => /item|product|produt|desc_store/i.test(k))
    );
    if (itemish.length) {
      console.log(`[v2] 🎯 candidatos com cara de venda por item:`);
      for (const h of itemish) {
        console.log(`     ${h.path} → ${h.count} linha(s) · keys=${(h.keys || []).join(",")}`);
        console.log(`     amostra: ${JSON.stringify(h.sample).slice(0, 400)}`);
      }
    } else {
      console.log(`[v2] nenhum endpoint devolveu linhas com cara de item vendido.`);
    }
    console.log(`[v2] relatório completo em saipos-endpoints.json (artifact)`);
  } catch (e) {
    console.error("[v2] falhou:", e.message);
    try {
      writeFileSync("saipos-endpoints.json", JSON.stringify(report, null, 2));
      await s.page.screenshot({ path: "saipos-v2-error.png", fullPage: true });
    } catch {}
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
