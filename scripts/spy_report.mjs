#!/usr/bin/env node
/**
 * Espião de tela: abre um relatório no app do Saipos e copia a chamada que o
 * próprio app monta. Serve quando reconstruir o filtro na mão não fecha —
 * em vez de adivinhar, a gente lê a requisição real.
 *
 * Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_REPORT (rota do app, default
 *      report/sales-by-period), SAIPOS_MATCH (trecho da URL a capturar).
 * Somente observação — nenhum POST é disparado por nós.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const REPORT = process.env.SAIPOS_REPORT || "report/sales-by-period";
const MATCH = process.env.SAIPOS_MATCH || "sales-by-period";

async function main() {
  const s = await openSaiposSession();
  const captured = [];
  try {
    s.page.on("request", (req) => {
      const u = req.url();
      if (u.includes("api.saipos.com") && u.includes(MATCH)) {
        captured.push({ method: req.method(), url: u, pretty: decodeURIComponent(u), headers: req.headers(), postData: req.postData() });
      }
    });

    const base = (process.env.SAIPOS_BASE_URL || "https://app.saipos.com").replace(/\/$/, "");
    const url = `${base}/#/app/${REPORT}`;
    console.log(`[spy] abrindo ${REPORT}`);
    await s.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await s.page.waitForTimeout(8000);

    // A tela costuma já buscar sozinha; se houver botão de busca, aciona.
    for (const sel of ['button:has-text("Buscar")', 'button:has-text("Pesquisar")', '[data-qa="search"]', "md-fab-trigger button"]) {
      const btn = s.page.locator(sel).first();
      if (await btn.count().catch(() => 0)) {
        console.log(`[spy] clicando em ${sel}`);
        await btn.click().catch(() => {});
        await s.page.waitForTimeout(6000);
        break;
      }
    }
    await s.page.waitForTimeout(4000);

    console.log(`\n[spy] ${captured.length} chamada(s) capturada(s) com "${MATCH}":\n`);
    captured.forEach((c, i) => console.log(`--- ${i + 1} · ${c.method}\n${c.pretty}\n`));

    // Reexecuta a URL EXATA do app (mesmo encoding) e depois troca só data/loja.
    // Se a do app volta cheia e a nossa vazia, a diferença está no encoding.
    const hit = captured.find((c) => c.method === "GET");
    if (hit) {
      const alvo = process.env.SAIPOS_DATE;
      const runUrl = async (rotulo, url) => {
        try {
          // Replica os headers da requisição do app (menos os de transporte,
          // que o Playwright monta sozinho) — a resposta depende deles.
          const h = { ...(hit.headers || {}) };
          for (const k of Object.keys(h)) {
            if (/^(host|content-length|connection|accept-encoding|:.*)$/i.test(k)) delete h[k];
          }
          h.authorization = h.authorization || s.authHeader;
          const res = await s.page.request.get(url, { headers: h, timeout: 30000 });
          const j = await res.json();
          console.log(`  ${rotulo}: HTTP ${res.status()} total=${j?.total ?? "?"} linhas=${(j?.rows || []).length}`);
          if (j?.summary) console.log(`     summary=${JSON.stringify(j.summary).slice(0, 900)}`);
          if ((j?.rows || []).length) console.log(`     keys=${Object.keys(j.rows[0]).join(",")}`);
          return j;
        } catch (e) {
          console.log(`  ${rotulo}: ERRO ${e.message.slice(0, 140)}`);
          return null;
        }
      };

      // Mostra os headers de contexto (sem authorization/fingerprint/cookie).
      const seguro = Object.entries(hit.headers || {}).filter(
        ([k]) => !/authorization|cookie|fingerprint|token|^[0-9a-f]{24,}$/i.test(k)
      );
      console.log(`[spy] headers da chamada real:`);
      seguro.forEach(([k, v]) => console.log(`    ${k}: ${String(v).slice(0, 120)}`));
      const sigilosos = Object.keys(hit.headers || {}).filter(([k]) => true).filter((k) => /authorization|cookie|fingerprint|token|^[0-9a-f]{24,}$/i.test(k));
      console.log(`    (omitidos: ${sigilosos.join(", ")})`);
      console.log(`[spy] reexecutando a chamada do app:`);
      await runUrl("url original", hit.url);

      if (alvo) {
        const datas = [...new Set((hit.pretty.match(/\d{2}\/\d{2}\/\d{4}/g) || []))];
        let url = hit.url;
        for (const d of datas) url = url.split(encodeURIComponent(d)).join(encodeURIComponent(alvo)).split(d).join(alvo);
        await runUrl(`data ${alvo}`, url);
        for (const loja of (process.env.SAIPOS_STORE_IDS || "49895,49897").split(",")) {
          const u = url.replace(/\/stores\/\d+\//, `/stores/${loja.trim()}/`);
          await runUrl(`data ${alvo} · loja ${loja.trim()}`, u);
        }
      }
    }

    writeFileSync("saipos-spy.json", JSON.stringify(captured.map((c) => ({ ...c, headers: Object.keys(c.headers || {}) })), null, 2));
    await s.page.screenshot({ path: "saipos-spy.png", fullPage: true }).catch(() => {});
  } catch (e) {
    console.error("[spy] falhou:", e.message);
    try {
      writeFileSync("saipos-spy.json", JSON.stringify(captured.map((c) => ({ ...c, headers: Object.keys(c.headers || {}) })), null, 2));
      await s.page.screenshot({ path: "saipos-spy.png", fullPage: true });
    } catch {}
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
