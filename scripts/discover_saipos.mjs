#!/usr/bin/env node
/**
 * ESPIÃO da API do Saipos — descoberta de endpoints (somente leitura, GET).
 *
 * Objetivo: mapear a API interna do Saipos pra saber QUAL URL responde cada
 * pergunta (produtos, ficha técnica, itens mais vendidos...). É o passo 1 do
 * "driver Saipos" — descoberto uma vez, vale pra todo cliente que usa Saipos.
 *
 * O que faz:
 *   1. Loga (reusa a mesma lógica do scrape_saipos) e captura o Authorization.
 *   2. PASSIVO: registra toda URL de api.saipos.com que o app chama sozinho.
 *   3. ATIVO: sonda uma lista de endpoints candidatos com GET (zero escrita).
 *   4. Cospe um relatório JSON (saipos-discovery.json) + resumo no log.
 *
 * NÃO grava nada no Saipos nem no Supabase. É só reconhecimento.
 *
 * Variáveis: SAIPOS_USER, SAIPOS_PASS, SAIPOS_BASE_URL (default app.saipos.com),
 *            SAIPOS_STORE_IDS (default 49895,49897).
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE_URL = process.env.SAIPOS_BASE_URL || "https://app.saipos.com";
const USER = process.env.SAIPOS_USER;
const PASS = process.env.SAIPOS_PASS;
const STORE_IDS = (process.env.SAIPOS_STORE_IDS || "49895,49897")
  .split(",")
  .map((s) => s.trim());

const SAIPOS_SELECTORS = {
  emailInput: 'input[placeholder="E-mail"], input[type="email"], input[name="email"]',
  passInput: 'input[placeholder="Senha"], input[type="password"]',
  submitBtn: 'button[type="submit"], button.md-fab, md-card button, button:has-text("Entrar")',
  dashboardMarker: '[data-test="dashboard"], a[href*="dashboard"], a[href*="painel"]',
};

function todayBR() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function login(page) {
  console.log(`[disc] navegando para ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(SAIPOS_SELECTORS.emailInput, { timeout: 30000 });
  await page.fill(SAIPOS_SELECTORS.emailInput, USER);
  await page.fill(SAIPOS_SELECTORS.passInput, PASS);
  const submit = page.locator(SAIPOS_SELECTORS.submitBtn).first();
  if (await submit.count()) {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      submit.click(),
    ]);
  } else {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      page.press(SAIPOS_SELECTORS.passInput, "Enter"),
    ]);
  }
  await page.waitForTimeout(5000);
  const takeover = page.locator('button:has-text("SIM"), .md-button:has-text("SIM")').first();
  if (await takeover.count()) {
    console.log("[disc] sessão ativa em outro PC — assumindo (SIM)");
    await takeover.click();
    await page.waitForTimeout(5000);
  }
  console.log(`[disc] URL pós-login: ${page.url()}`);
  await page
    .waitForSelector(SAIPOS_SELECTORS.dashboardMarker, { timeout: 30000 })
    .catch(() => console.warn("[disc] dashboardMarker não achado — seguindo"));
}

async function selectStore(page) {
  let row = page.locator(`tr:has-text("${STORE_IDS[0]}")`).first();
  if (!(await row.count())) row = page.locator('tr:has-text("Ativo")').first();
  if (await row.count()) {
    console.log(`[disc] selecionando loja ${STORE_IDS[0]}`);
    await row.locator("button").first().click();
    await page.waitForTimeout(6000);
    console.log(`[disc] URL pós-loja: ${page.url()}`);
  } else {
    console.log("[disc] tela de seleção de loja não apareceu — seguindo");
  }
}

// Endpoints candidatos (GET). Baseados no padrão conhecido:
//   api.saipos.com/v1/stores/{id}/<recurso>
// A ideia é achar o que lista produtos + ficha técnica + mais vendidos.
// {DATE} vira DD/MM/YYYY de hoje; {FILTER} vira um filtro básico de período.
function candidatePaths() {
  const date = todayBR();
  const filter = encodeURIComponent(
    JSON.stringify({
      start_date: date,
      end_date: date,
      exclude_canceled: 1,
      only_nfe: 0,
      id_store_shift: 0,
      id_sale_types: ["1", "2", "3", "4"],
      id_user_stores: null,
    })
  );
  // grupos por intenção, pra ficar legível no relatório
  return [
    // --- produtos / cardápio ---
    ["produtos", "products"],
    ["produtos", "menu/products"],
    ["produtos", "menu-items"],
    ["produtos", "items"],
    ["produtos", "catalog"],
    ["produtos", "menu"],
    ["produtos", "categories"],
    ["produtos", "menu/categories"],
    // --- ficha técnica / insumos / estoque ---
    ["ficha", "recipes"],
    ["ficha", "technical-sheets"],
    ["ficha", "technical-sheet"],
    ["ficha", "product-recipes"],
    ["ficha", "inputs"],
    ["ficha", "ingredients"],
    ["ficha", "stock/inputs"],
    ["ficha", "stock/products"],
    ["ficha", "stock"],
    ["ficha", "supplies"],
    // --- vendas / mais vendidos ---
    ["vendas", `sales-by-payment-type?filter=${filter}`], // conhecido (âncora de sanidade)
    ["vendas", `sales-by-product?filter=${filter}`],
    ["vendas", `sales-by-item?filter=${filter}`],
    ["vendas", `products-sold?filter=${filter}`],
    ["vendas", `best-sellers?filter=${filter}`],
    ["vendas", `sales-by-category?filter=${filter}`],
    ["vendas", `sales-summary?filter=${filter}`],
    // --- meta / loja ---
    ["loja", ""],
    ["loja", "config"],
    ["loja", "info"],
  ];
}

async function probe(page, authHeader, storeId, group, path) {
  const url = `https://api.saipos.com/v1/stores/${storeId}/${path}`;
  try {
    const res = await page.request.get(url, {
      headers: { authorization: authHeader },
      timeout: 20000,
    });
    const status = res.status();
    let sample = null;
    let count = null;
    let keys = null;
    if (res.ok()) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          count = json.length;
          keys = json.length ? Object.keys(json[0]) : [];
          sample = json.slice(0, 2);
        } else if (json && typeof json === "object") {
          keys = Object.keys(json);
          sample = json;
        } else {
          sample = json;
        }
      } catch {
        sample = text.slice(0, 300);
      }
    }
    return { group, path, url, status, ok: res.ok(), count, keys, sample };
  } catch (e) {
    return { group, path, url, status: "ERR", ok: false, error: e.message };
  }
}

async function main() {
  if (!USER || !PASS) {
    console.error("[disc] SAIPOS_USER e SAIPOS_PASS são obrigatórias");
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const page = await context.newPage();

  // PASSIVO: token + toda URL de api.saipos.com que o app chamar sozinho.
  let authHeader = null;
  const observedUrls = new Set();
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("api.saipos.com")) {
      observedUrls.add(`${req.method()} ${u.split("?")[0]}`);
      const h = req.headers()["authorization"];
      if (h) authHeader = h;
    }
  });

  const report = { generated_for: STORE_IDS, base_url: BASE_URL, passive: [], active: [] };

  try {
    await login(page);
    await selectStore(page);
    // deixa o dashboard respirar pra revelar mais chamadas passivas + token
    await page.waitForTimeout(6000);
    if (!authHeader) throw new Error("não capturei o Authorization da sessão");

    report.passive = Array.from(observedUrls).sort();
    console.log(`\n[disc] === ${report.passive.length} URLs observadas passivamente ===`);
    report.passive.forEach((u) => console.log("  ·", u));

    // ATIVO: sonda candidatos só na 1ª loja (a ativa). GET apenas.
    const storeId = STORE_IDS[0];
    console.log(`\n[disc] === sondando candidatos na loja ${storeId} (GET) ===`);
    for (const [group, path] of candidatePaths()) {
      const r = await probe(page, authHeader, storeId, group, path);
      report.active.push(r);
      const tag = r.ok ? "✓ 200" : `✗ ${r.status}`;
      const extra = r.ok
        ? r.count != null
          ? `array[${r.count}] keys=${(r.keys || []).slice(0, 8).join(",")}`
          : `obj keys=${(r.keys || []).slice(0, 8).join(",")}`
        : "";
      console.log(`  ${tag}  ${group}/${path.split("?")[0]}  ${extra}`);
    }

    writeFileSync("saipos-discovery.json", JSON.stringify(report, null, 2));
    console.log("\n[disc] relatório completo salvo em saipos-discovery.json");
    const hits = report.active.filter((r) => r.ok).map((r) => r.path.split("?")[0]);
    console.log(`[disc] endpoints que responderam 200: ${hits.join(", ") || "(nenhum)"}`);
  } catch (e) {
    console.error("[disc] falhou:", e.message);
    try {
      await page.screenshot({ path: "saipos-discovery-error.png", fullPage: true });
    } catch {}
    // ainda assim salva o que capturou
    try {
      report.passive = Array.from(observedUrls).sort();
      writeFileSync("saipos-discovery.json", JSON.stringify(report, null, 2));
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
