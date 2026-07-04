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
// Loja ativa do TOCS no Saipos (49897 é o CNPJ novo, "Em implantação")
const STORE_ID = process.env.SAIPOS_STORE_ID || "49895";

// Selectors — ajustar quando confirmar a estrutura real do Saipos
const SAIPOS_SELECTORS = {
  // Login em conta.saipos.com (Angular): inputs identificados pelo placeholder,
  // submit é um botão redondo (FAB) com seta, sem texto.
  emailInput: 'input[placeholder="E-mail"], input[type="email"], input[name="email"]',
  passInput: 'input[placeholder="Senha"], input[type="password"]',
  submitBtn: 'button[type="submit"], button.md-fab, md-card button, button:has-text("Entrar")',
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
  const submit = page.locator(SAIPOS_SELECTORS.submitBtn).first();
  if (await submit.count()) {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      submit.click(),
    ]);
  } else {
    // fallback: Enter no campo de senha
    console.log("[saipos] botao de submit nao encontrado — usando Enter");
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      page.press(SAIPOS_SELECTORS.passInput, "Enter"),
    ]);
  }
  // SPA Angular: dá um tempo pro redirect/render pós-login
  await page.waitForTimeout(5000);

  // Saipos permite 1 sessão por usuário: se aparecer o diálogo
  // "já está conectado em outro computador", assume a sessão (SIM).
  // IMPORTANTE: usar um usuário dedicado pro robô — senão isso derruba o PDV.
  const takeover = page.locator('button:has-text("SIM"), .md-button:has-text("SIM")').first();
  if (await takeover.count()) {
    console.log("[saipos] sessão ativa em outro computador — assumindo (SIM)");
    await takeover.click();
    await page.waitForTimeout(5000);
  }
  console.log(`[saipos] URL pós-login: ${page.url()}`);

  console.log("[saipos] aguardando dashboard");
  await page
    .waitForSelector(SAIPOS_SELECTORS.dashboardMarker, { timeout: 30000 })
    .catch(() => {
      console.warn("[saipos] dashboardMarker não encontrado — tentando seguir mesmo assim");
    });
}

async function selectStore(page) {
  // Pós-login cai em "Selecione a loja" (tabela com botão-seta por linha).
  let row = page.locator(`tr:has-text("${STORE_ID}")`).first();
  if (!(await row.count())) {
    // fallback: a linha da loja com status "Ativo"
    row = page.locator('tr:has-text("Ativo")').first();
  }
  if (await row.count()) {
    console.log(`[saipos] selecionando loja ${STORE_ID}`);
    await row.locator("button").first().click();
    await page.waitForTimeout(6000);
    console.log(`[saipos] URL pós-loja: ${page.url()}`);
  } else {
    console.log("[saipos] tela de seleção de loja não apareceu — seguindo");
  }
}

async function gotoSalesDashboard(page) {
  // Painel "Acompanhamento de vendas" — mostra o dia corrente ao vivo
  console.log("[saipos] abrindo acompanhamento de vendas");
  await page.goto(`${BASE_URL}/#/app/dashboard/sales-tracking`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(8000); // SPA: espera os cards carregarem
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
    await selectStore(page);
    await gotoSalesDashboard(page);
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
      // abre o menu lateral e lista todas as rotas visíveis no DOM
      await page.locator("md-toolbar button, header button, .md-toolbar-tools button").first().click().catch(() => {});
      await page.waitForTimeout(2000);
      const links = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")]
          .map((a) => `${a.getAttribute("href")} :: ${a.textContent.trim().replace(/\s+/g, " ").slice(0, 60)}`)
          .filter((s) => s.includes("#/app"))
      );
      console.log("[saipos] rotas encontradas:\n" + links.join("\n"));
      // screenshot da tela pós-login pra calibrar seletores
      await page.screenshot({ path: "saipos-error.png", fullPage: true });
      console.log("[saipos] screenshot pós-login salvo (artifact)");
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
