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
        captured.push({ method: req.method(), url: decodeURIComponent(u), postData: req.postData() });
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
    captured.forEach((c, i) => {
      console.log(`--- ${i + 1} · ${c.method}`);
      console.log(c.url);
      if (c.postData) console.log(`postData: ${c.postData.slice(0, 800)}`);
      console.log("");
    });

    writeFileSync("saipos-spy.json", JSON.stringify(captured, null, 2));
    await s.page.screenshot({ path: "saipos-spy.png", fullPage: true }).catch(() => {});
  } catch (e) {
    console.error("[spy] falhou:", e.message);
    try {
      writeFileSync("saipos-spy.json", JSON.stringify(captured, null, 2));
      await s.page.screenshot({ path: "saipos-spy.png", fullPage: true });
    } catch {}
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
