#!/usr/bin/env node
/**
 * Vendas do dia, venda a venda — pela tela do relatório.
 *
 * Por que não chamar a API direto: o `x-fingerprint` que o app manda assina a
 * requisição. Reusar o header com outro filtro faz o backend devolver 200 com
 * lista VAZIA (não dá erro). Ou seja, só a query que o próprio app montou vale.
 * Então aqui a gente deixa o app buscar e captura as RESPOSTAS.
 *
 * Estratégia: abrir "Vendas por período", pôr as datas do dia, buscar, subir o
 * tamanho da página para 100 e, se ainda faltar, avançar as páginas.
 *
 * Saída: JSON com as vendas do dia + o resumo do Saipos. Somente leitura.
 * Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_DATE (DD/MM/YYYY), SAIPOS_STORE_IDS.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

function defaultDateBR() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
const DATE = process.env.SAIPOS_DATE || defaultDateBR();

function nextDay(br) {
  const [d, m, y] = br.split("/");
  const dt = new Date(`${y}-${m}-${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  const [yy, mm, dd] = dt.toISOString().slice(0, 10).split("-");
  return `${dd}/${mm}/${yy}`;
}

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => Number(String(v ?? 0).replace(",", ".")) || 0;

async function main() {
  const s = await openSaiposSession();
  const respostas = [];
  try {
    // Captura as RESPOSTAS do relatório — é o dado que interessa.
    s.page.on("response", async (res) => {
      if (!res.url().includes("sales-by-period")) return;
      try {
        const j = await res.json();
        if (j && (j.rows || j.total != null)) respostas.push(j);
      } catch {}
    });

    const base = (process.env.SAIPOS_BASE_URL || "https://app.saipos.com").replace(/\/$/, "");
    await s.page.goto(`${base}/#/app/report/sales-by-period`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await s.page.waitForTimeout(9000);

    // Datas: a janela do Saipos é aberta no fim, então pedimos dia → dia+1
    // e filtramos depois. Os campos são inputs de data do Angular Material.
    const inputs = s.page.locator('input[type="date"], input[placeholder*="/"], md-datepicker input');
    const qtd = await inputs.count().catch(() => 0);
    console.log(`[dia] ${qtd} campo(s) de data na tela`);
    if (qtd >= 2) {
      for (const [i, valor] of [[0, DATE], [1, nextDay(DATE)]]) {
        const el = inputs.nth(i);
        await el.click({ timeout: 5000 }).catch(() => {});
        await el.fill("").catch(() => {});
        await el.type(valor, { delay: 60 }).catch(() => {});
        await s.page.keyboard.press("Escape").catch(() => {});
      }
      console.log(`[dia] datas preenchidas: ${DATE} → ${nextDay(DATE)}`);
    } else {
      console.log(`[dia] não achei os campos de data — seguindo com o período padrão da tela`);
    }

    const buscar = s.page.locator('button:has-text("Buscar")').first();
    if (await buscar.count().catch(() => 0)) {
      await buscar.click().catch(() => {});
      await s.page.waitForTimeout(9000);
    }

    // Sobe o tamanho da página: o rodapé tem 25 / 50 / 100.
    for (const rotulo of ["100", "50"]) {
      const b = s.page.locator(`button:has-text("${rotulo}"), .rows-per-page:has-text("${rotulo}")`).last();
      if (await b.count().catch(() => 0)) {
        console.log(`[dia] mudando para ${rotulo} linhas por página`);
        await b.click({ timeout: 5000 }).catch(() => {});
        await s.page.waitForTimeout(9000);
        break;
      }
    }

    // Se ainda faltar venda, avança as páginas.
    for (let i = 0; i < 10; i++) {
      const melhor = respostas.reduce((a, r) => ((r.rows || []).length > (a.rows || []).length ? r : a), { rows: [] });
      const total = Math.max(...respostas.map((r) => num(r.total)), 0);
      const vistas = new Set(respostas.flatMap((r) => (r.rows || []).map((x) => x.id_sale))).size;
      if (vistas >= total || !total) break;
      const prox = s.page.locator('[aria-label="Próxima"], [aria-label="Next"], button:has(md-icon:text("chevron_right"))').last();
      if (!(await prox.count().catch(() => 0))) {
        console.log(`[dia] sem botão de próxima página — parando com ${vistas}/${total}`);
        break;
      }
      console.log(`[dia] ${vistas}/${total} vendas — indo pra próxima página`);
      await prox.click({ timeout: 5000 }).catch(() => {});
      await s.page.waitForTimeout(8000);
    }

    // Junta tudo que veio, sem repetir venda.
    const porId = new Map();
    for (const r of respostas) for (const v of r.rows || []) porId.set(v.id_sale, v);
    const total = Math.max(...respostas.map((r) => num(r.total)), 0);
    const summary = respostas.find((r) => r.summary)?.summary || null;

    const spDate = (ts) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ts));
    const alvo = DATE.split("/").reverse().join("-");
    const doDia = Array.from(porId.values()).filter((v) => v.created_at && spDate(v.created_at) === alvo);

    console.log(`\n[dia] ${porId.size} venda(s) capturada(s) de ${total} na janela · ${doDia.length} em ${DATE}`);
    if (porId.size < total) console.log(`[dia] ⚠️  faltaram ${total - porId.size} venda(s) da janela — números abaixo incompletos`);

    const soma = (f) => doDia.reduce((a, v) => a + num(f(v)), 0);
    const itens = soma((v) => v.total_amount_items);
    const desconto = soma((v) => v.total_discount);
    const acrescimo = soma((v) => v.total_increase);
    const entrega = soma((v) => v.delivery_fee);
    const liquido = soma((v) => v.total_amount);
    console.log(`  itens ${brl(itens)} · desconto ${brl(desconto)} · acréscimo ${brl(acrescimo)} · entrega ${brl(entrega)} → total ${brl(liquido)}`);
    if (itens > 0) console.log(`  desconto = ${((desconto / itens) * 100).toFixed(1)}% do valor de menu`);

    writeFileSync(
      "saipos-vendas-dia.json",
      JSON.stringify({ date: DATE, total_na_janela: total, capturadas: porId.size, do_dia: doDia.length, summary, vendas: doDia }, null, 2)
    );
    await s.page.screenshot({ path: "saipos-vendas-dia.png", fullPage: true }).catch(() => {});
  } catch (e) {
    console.error("[dia] falhou:", e.message);
    try {
      await s.page.screenshot({ path: "saipos-vendas-dia.png", fullPage: true });
    } catch {}
    process.exitCode = 1;
  } finally {
    await s.close();
  }
}

main();
