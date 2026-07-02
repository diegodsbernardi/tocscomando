#!/usr/bin/env node
/**
 * Scraper do dashboard Saipos.
 *
 * Roda em ambiente headless (GitHub Actions ou local) via Playwright.
 * Lê credenciais de env vars (SAIPOS_USER, SAIPOS_PASS) e insere snapshot
 * em public.saipos_snapshots via service_role.
 *
 * Variáveis necessárias:
 *   SAIPOS_USER, SAIPOS_PASS — login do operador no Saipos
 *   SAIPOS_BASE_URL          — default https://app.saipos.com
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DRY_RUN=1                — não escreve no banco, só loga
 *
 * Seletores estão em SAIPOS_SELECTORS no topo — se algo mudar, ajustar lá.
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

// ---------- config ----------
const BASE_URL = process.env.SAIPOS_BASE_URL || "https://app.saipos.com";
const USER = process.env.SAIPOS_USER;
const PASS = process.env.SAIPOS_PASS;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";

// Selectors — ajustar quando confirmar a estrutura real do Saipos
const SAIPOS_SELECTORS = {
  emailInput: 'input[name="email"], input[type="email"], input[name="login"]',
  passInput: 'input[name="password"], input[type="password"]',
  submitBtn: 'button[type="submit"], button:has-text("Entrar"), button:has-text("Login")',
  // pós-login: aguardamos um marker que indica que estamos no dashboard
  dashboardMarker: '[data-test="dashboard"], a[href*="dashboard"], a[href*="painel"]',
  // sales card (placeholders — vão ser ajustados pelo Diego ao testar)
  totalSales: '[data-test="total-sales"], .total-vendas',
  cashSales: '[data-test="cash-sales"], .vendas-dinheiro',
  cardSales: '[data-test="card-sales"], .vendas-cartao',
  pixSales: '[data-test="pix-sales"], .vendas-pix',
};

function todayISO() {
  // Data do dia de trabalho no fuso do restaurante — Actions roda em UTC,
  // e depois da meia-noite UTC ainda é o mesmo dia em BRT.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function parseBR(text) {
  if (!text) return null;
  // "R$ 1.234,56" → 1234.56
  const cleaned = text.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function login(page) {
  console.log(`[saipos] navegando para ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  console.log("[saipos] aguardando campo de email");
  await page.waitForSelector(SAIPOS_SELECTORS.emailInput, { timeout: 30000 });
  await page.fill(SAIPOS_SELECTORS.emailInput, USER);
  await page.fill(SAIPOS_SELECTORS.passInput, PASS);

  console.log("[saipos] submitting login");
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
    page.click(SAIPOS_SELECTORS.submitBtn),
  ]);

  console.log("[saipos] aguardando dashboard");
  await page
    .waitForSelector(SAIPOS_SELECTORS.dashboardMarker, { timeout: 30000 })
    .catch(() => {
      console.warn("[saipos] dashboardMarker não encontrado — tentando seguir mesmo assim");
    });
}

async function extractSales(page) {
  // Tenta extrair os valores de venda do dia.
  // Se algum seletor falhar, retorna null pro campo (snapshot ainda é gravado pra debug).
  const data = await page.evaluate((sel) => {
    const tx = (s) => {
      const el = document.querySelector(s);
      return el ? el.textContent?.trim() : null;
    };
    return {
      total: tx(sel.totalSales),
      cash: tx(sel.cashSales),
      card: tx(sel.cardSales),
      pix: tx(sel.pixSales),
      // Snapshot da página inteira pra debug — primeiro 5KB de HTML
      html_preview: document.body?.innerText?.slice(0, 5000) ?? null,
    };
  }, SAIPOS_SELECTORS);

  return {
    total_sales: parseBR(data.total),
    cash_sales: parseBR(data.cash),
    card_sales: parseBR(data.card),
    pix_sales: parseBR(data.pix),
    raw: data,
  };
}

async function main() {
  if (!USER || !PASS) {
    console.error("[saipos] SAIPOS_USER e SAIPOS_PASS são obrigatórias");
    process.exit(1);
  }
  if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_ROLE)) {
    console.error("[saipos] NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias (ou use DRY_RUN=1)");
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

  try {
    await login(page);
    const sales = await extractSales(page);
    console.log("[saipos] vendas extraídas:", {
      total: sales.total_sales,
      cash: sales.cash_sales,
      card: sales.card_sales,
      pix: sales.pix_sales,
    });

    if (DRY_RUN) {
      console.log("[saipos] DRY_RUN — não gravando no banco");
      console.log("[saipos] raw:", JSON.stringify(sales.raw).slice(0, 2000));
      return;
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from("saipos_snapshots").insert({
      work_date: todayISO(),
      drawer_name: null, // consolidado (DLV + LTDA juntos)
      total_sales: sales.total_sales,
      cash_sales: sales.cash_sales,
      card_sales: sales.card_sales,
      pix_sales: sales.pix_sales,
      source: "scrape",
      raw: sales.raw,
    });

    if (error) {
      console.error("[saipos] erro ao gravar:", error.message);
      process.exit(1);
    }
    console.log("[saipos] snapshot gravado ✓");
  } catch (e) {
    console.error("[saipos] falhou:", e.message);
    // Salva screenshot pra debug
    try {
      await page.screenshot({ path: "saipos-error.png", fullPage: true });
      console.log("[saipos] screenshot salvo em saipos-error.png");
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
