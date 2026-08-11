/**
 * Sessão Saipos reusável — camada 1 do "driver Saipos".
 *
 * Loga via Playwright, captura o token Authorization que o app manda pra
 * api.saipos.com e expõe um helper de GET pra chamar a API interna direto.
 * Qualquer comando novo (itens sem ficha, mais vendidos, custos...) usa isto.
 *
 * Uso:
 *   const s = await openSaiposSession();
 *   const items = await s.get(s.storeIds[0], "items");
 *   await s.close();
 *
 * Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_BASE_URL (default app.saipos.com),
 *      SAIPOS_STORE_IDS (default 49895,49897).
 */

import { chromium } from "playwright";

const SELECTORS = {
  emailInput: 'input[placeholder="E-mail"], input[type="email"], input[name="email"]',
  passInput: 'input[placeholder="Senha"], input[type="password"]',
  submitBtn: 'button[type="submit"], button.md-fab, md-card button, button:has-text("Entrar")',
  dashboardMarker: '[data-test="dashboard"], a[href*="dashboard"], a[href*="painel"]',
};

async function login(page, baseUrl, user, pass, storeId0) {
  console.log(`[saipos] navegando para ${baseUrl}`);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(SELECTORS.emailInput, { timeout: 30000 });
  await page.fill(SELECTORS.emailInput, user);
  await page.fill(SELECTORS.passInput, pass);
  const submit = page.locator(SELECTORS.submitBtn).first();
  if (await submit.count()) {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      submit.click(),
    ]);
  } else {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
      page.press(SELECTORS.passInput, "Enter"),
    ]);
  }
  await page.waitForTimeout(5000);
  // Saipos permite 1 sessão por usuário — assume a sessão se perguntar.
  const takeover = page.locator('button:has-text("SIM"), .md-button:has-text("SIM")').first();
  if (await takeover.count()) {
    console.log("[saipos] sessão ativa em outro PC — assumindo (SIM)");
    await takeover.click();
    await page.waitForTimeout(5000);
  }
  await page
    .waitForSelector(SELECTORS.dashboardMarker, { timeout: 30000 })
    .catch(() => console.warn("[saipos] dashboardMarker não achado — seguindo"));

  // Seleção de loja (valida a sessão; a extração é via API).
  let row = page.locator(`tr:has-text("${storeId0}")`).first();
  if (!(await row.count())) row = page.locator('tr:has-text("Ativo")').first();
  if (await row.count()) {
    await row.locator("button").first().click();
    await page.waitForTimeout(6000);
  }
  console.log(`[saipos] URL pós-login/loja: ${page.url()}`);
}

export async function openSaiposSession() {
  const baseUrl = process.env.SAIPOS_BASE_URL || "https://app.saipos.com";
  const user = process.env.SAIPOS_USER;
  const pass = process.env.SAIPOS_PASS;
  const storeIds = (process.env.SAIPOS_STORE_IDS || "49895,49897")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!user || !pass) throw new Error("SAIPOS_USER e SAIPOS_PASS são obrigatórias");

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

  // Guardamos o conjunto COMPLETO de headers que o app manda pra api.saipos.com.
  // Só o Authorization não basta: alguns relatórios (sales-by-period) respondem
  // 200 com resultado vazio quando faltam os headers de contexto/fingerprint.
  let authHeader = null;
  let apiHeaders = null;
  page.on("request", (req) => {
    if (req.url().includes("api.saipos.com")) {
      const hs = req.headers();
      if (hs["authorization"]) {
        authHeader = hs["authorization"];
        apiHeaders = hs;
      }
    }
  });

  // O Saipos admite UMA sessão por usuário: se outro job logar no meio, este
  // aqui é deslogado e o token nunca aparece. Em vez de morrer na hora, tenta
  // de novo — a colisão dura o tempo do outro job pegar o que precisa.
  const TENTATIVAS = Number(process.env.SAIPOS_LOGIN_TRIES || 3);
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      await login(page, baseUrl, user, pass, storeIds[0]);
      await page.waitForTimeout(4000); // deixa o app revelar o token
    } catch (e) {
      console.warn(`[saipos] login (tentativa ${tentativa}) falhou: ${e.message.slice(0, 120)}`);
    }
    if (authHeader) break;
    if (tentativa < TENTATIVAS) {
      const espera = 30000 * tentativa; // 30s, 60s
      console.warn(`[saipos] sem Authorization (tentativa ${tentativa}/${TENTATIVAS}) — outra sessão pode ter assumido. Esperando ${espera / 1000}s`);
      await page.waitForTimeout(espera);
    }
  }
  if (!authHeader) {
    throw new Error(`não capturei o Authorization da sessão após ${TENTATIVAS} tentativa(s)`);
  }

  // Headers de transporte o Playwright monta sozinho — mandar de volta quebra.
  // O backend usa x-source-context (o nome da tela que originou a chamada) pra
  // decidir o que devolver: com o contexto errado, relatórios respondem 200 com
  // lista vazia em vez de erro. Ex.: "app.report.sales-by-period".
  const clean = (raw) => {
    const h = { ...(raw || {}) };
    for (const k of Object.keys(h)) {
      if (/^(host|content-length|connection|accept-encoding)$/i.test(k) || k.startsWith(":")) delete h[k];
    }
    h.authorization = authHeader;
    return h;
  };

  const headersForApi = (context) => {
    const h = clean(apiHeaders);
    if (context) h["x-source-context"] = context;
    return h;
  };

  /**
   * Abre uma tela do app e devolve os headers que ELA usa nas chamadas de API.
   * Alguns relatórios só respondem com o conjunto completo (x-source-context +
   * x-fingerprint, este gerado por JS na página) — forjar na mão não cola.
   */
  const warmupReport = async (route, match) => {
    let found = null;
    const onReq = (req) => {
      const u = req.url();
      if (u.includes("api.saipos.com") && u.includes(match)) found = req.headers();
    };
    page.on("request", onReq);
    try {
      await page.goto(`${baseUrl}/#/app/${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(8000);
      for (const sel of ['button:has-text("Buscar")', 'button:has-text("Pesquisar")', '[data-qa="search"]']) {
        const btn = page.locator(sel).first();
        if (await btn.count().catch(() => 0)) {
          await btn.click().catch(() => {});
          await page.waitForTimeout(6000);
          break;
        }
      }
      await page.waitForTimeout(3000);
    } finally {
      page.off("request", onReq);
    }
    console.log(`[saipos] warmup ${route}: ${found ? "headers capturados" : "NENHUMA chamada vista"}`);
    return found ? clean(found) : null;
  };

  const get = async (storeId, path, opts = {}) => {
    const url = `https://api.saipos.com/v1/stores/${storeId}/${path}`;
    const res = await page.request.get(url, {
      headers: opts.headers ? { ...clean(opts.headers), authorization: authHeader } : headersForApi(opts.context),
      timeout: 30000,
    });
    if (!res.ok()) {
      throw new Error(`GET ${path} → HTTP ${res.status()}: ${(await res.text()).slice(0, 200)}`);
    }
    return res.json();
  };

  return {
    page,
    authHeader,
    headersForApi,
    warmupReport,
    storeIds,
    get,
    async close() {
      await browser.close();
    },
  };
}
