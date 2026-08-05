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
import { createClient } from "@supabase/supabase-js";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";

function defaultDateBR() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dt = new Date(`${iso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + Number(process.env.SAIPOS_DAY_OFFSET || 0));
  const [y, m, d] = dt.toISOString().slice(0, 10).split("-");
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

    const storeId = s.storeIds[0]; // a sessão entra numa loja só; o workflow roda uma vez por loja
    const base = (process.env.SAIPOS_BASE_URL || "https://app.saipos.com").replace(/\/$/, "");
    console.log(`[dia] loja ${storeId} · ${DATE}`);
    await s.page.goto(`${base}/#/app/report/sales-by-period`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await s.page.waitForTimeout(9000);

    // Datas: a janela do Saipos é aberta no fim, então pedimos dia → dia+1
    // e filtramos depois. Os campos são inputs de data do Angular Material.
    const inputs = s.page.locator('.md-datepicker-input, input[type="date"], md-datepicker input');
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

    // Canceladas ficam de fora das somas (o caixa também não as conta), mas
    // são registradas à parte — cancelamento demais é sinal por si só.
    const canceladas = doDia.filter((v) => v.sale_canceled === true || v.sale_canceled === "Y");
    const validas = doDia.filter((v) => !canceladas.includes(v));

    const soma = (rows, f) => rows.reduce((a, v) => a + num(f(v)), 0);
    const itens = soma(validas, (v) => v.total_amount_items);
    const desconto = soma(validas, (v) => v.total_discount);
    const acrescimo = soma(validas, (v) => v.total_increase);
    const entrega = soma(validas, (v) => v.delivery_fee);
    const servico = soma(validas, (v) => v.total_service_charge_amount);
    const liquido = soma(validas, (v) => v.total_amount);

    // "Voucher Parceiro Desconto" = cupom do marketplace (iFood etc.), não é
    // alguém dando desconto no balcão. Só o manual interessa pro alerta.
    const ehVoucher = (v) => /voucher|parceiro/i.test(v.desc_payment_types || "");
    const comDesconto = validas.filter((v) => num(v.total_discount) > 0);
    const manuais = comDesconto.filter((v) => !ehVoucher(v));
    const descontoManual = soma(manuais, (v) => v.total_discount);

    console.log(`  itens ${brl(itens)} · desconto ${brl(desconto)} · acréscimo ${brl(acrescimo)} · entrega ${brl(entrega)} → total ${brl(liquido)}`);
    if (itens > 0) {
      console.log(`  desconto total  ${brl(desconto)} = ${((desconto / itens) * 100).toFixed(1)}% do valor de menu (${comDesconto.length} venda(s))`);
      console.log(`  desconto MANUAL ${brl(descontoManual)} = ${((descontoManual / itens) * 100).toFixed(1)}% (${manuais.length} venda(s), fora cupom de parceiro)`);
    }
    if (canceladas.length) console.log(`  ${canceladas.length} venda(s) cancelada(s), ${brl(soma(canceladas, (v) => v.total_amount))}`);
    manuais
      .sort((a, b) => num(b.total_discount) - num(a.total_discount))
      .slice(0, 10)
      .forEach((v) =>
        console.log(`    #${v.sale_number} ${brl(v.total_amount)} − ${brl(v.total_discount)} · ${v.desc_payment_types || "-"} · motivo: ${v.discount_reason || "(sem motivo)"}`)
      );

    // ---- gravação ----
    if (!DRY_RUN && SUPABASE_URL && SERVICE_ROLE && doDia.length) {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
      const workDate = DATE.split("/").reverse().join("-");

      const { error: e1 } = await supabase.from("saipos_daily_sales").upsert(
        {
          work_date: workDate,
          store_id: storeId,
          sales_count: validas.length,
          items_amount: itens,
          discount_amount: desconto,
          manual_discount_amount: descontoManual,
          increase_amount: acrescimo,
          delivery_fee: entrega,
          service_charge: servico,
          net_amount: liquido,
          canceled_count: canceladas.length,
          canceled_amount: soma(canceladas, (v) => v.total_amount),
          captured_at: new Date().toISOString(),
        },
        { onConflict: "work_date,store_id" }
      );
      if (e1) console.error(`  erro gravando resumo: ${e1.message}`);
      else console.log(`  resumo do dia gravado ✓`);

      if (comDesconto.length) {
        const linhas = comDesconto.map((v) => ({
          work_date: workDate,
          store_id: storeId,
          id_sale: v.id_sale,
          sale_number: String(v.sale_number ?? ""),
          sold_at: v.created_at,
          shift: v.desc_store_shift ?? null,
          total_amount: num(v.total_amount),
          discount_amount: num(v.total_discount),
          discount_reason: v.discount_reason || null,
          payment_types: v.desc_payment_types || null,
          is_partner_voucher: ehVoucher(v),
          captured_at: new Date().toISOString(),
        }));
        const { error: e2 } = await supabase
          .from("saipos_discount_sales")
          .upsert(linhas, { onConflict: "work_date,store_id,id_sale" });
        if (e2) console.error(`  erro gravando descontos: ${e2.message}`);
        else console.log(`  ${linhas.length} venda(s) com desconto gravada(s) ✓`);
      }
    } else if (DRY_RUN) {
      console.log(`  DRY_RUN — nada gravado`);
    }

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
