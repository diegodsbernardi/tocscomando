#!/usr/bin/env node
/**
 * Espião de paginação: faz o app abrir a página 2 do relatório "Vendas por
 * período" e copia a chamada dela. Reproduzir a paginação na mão não funcionou
 * (a partir da 2ª página a API devolve lista vazia), então lemos o que o app
 * realmente manda. Somente observação.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

async function main() {
  const s = await openSaiposSession();
  const calls = [];
  try {
    s.page.on("request", (req) => {
      const u = req.url();
      if (u.includes("sales-by-period")) calls.push(decodeURIComponent(u));
    });

    const base = (process.env.SAIPOS_BASE_URL || "https://app.saipos.com").replace(/\/$/, "");
    await s.page.goto(`${base}/#/app/report/sales-by-period`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await s.page.waitForTimeout(9000);

    const buscar = s.page.locator('button:has-text("Buscar")').first();
    if (await buscar.count().catch(() => 0)) {
      await buscar.click().catch(() => {});
      await s.page.waitForTimeout(8000);
    }
    const antes = calls.length;
    console.log(`[pag] ${antes} chamada(s) após a busca inicial`);

    // Tenta ir pra página 2 por vários caminhos (o rodapé tem números e setas).
    const alvos = [
      'button:has-text("2")',
      '.pagination button:has-text("2")',
      '[aria-label="Próxima"]',
      '[aria-label="Next"]',
      'md-icon:has-text("chevron_right")',
      'button:has(md-icon:has-text("chevron_right"))',
      'button:has-text("50")', // trocar o tamanho da página também refaz a busca
    ];
    for (const sel of alvos) {
      const el = s.page.locator(sel).last();
      if (!(await el.count().catch(() => 0))) continue;
      console.log(`[pag] clicando ${sel}`);
      await el.click({ timeout: 5000 }).catch((e) => console.log(`   falhou: ${e.message.slice(0, 60)}`));
      await s.page.waitForTimeout(7000);
      if (calls.length > antes) {
        console.log(`[pag] nova chamada capturada via ${sel}`);
        break;
      }
    }

    console.log(`\n[pag] ${calls.length} chamada(s) no total:\n`);
    calls.forEach((c, i) => {
      const f = c.split("filter=")[1] || c;
      console.log(`--- ${i + 1}\n${f}\n`);
    });
    writeFileSync("saipos-paginacao.json", JSON.stringify(calls, null, 2));
    await s.page.screenshot({ path: "saipos-paginacao.png", fullPage: true }).catch(() => {});
  } catch (e) {
    console.error("[pag] falhou:", e.message);
    try {
      writeFileSync("saipos-paginacao.json", JSON.stringify(calls, null, 2));
      await s.page.screenshot({ path: "saipos-paginacao.png", fullPage: true });
    } catch {}
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
