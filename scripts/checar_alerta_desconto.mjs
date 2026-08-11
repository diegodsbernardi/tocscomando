#!/usr/bin/env node
/**
 * Verifica se o alerta de desconto de BALCÃO disparou e escreve o veredito em
 * docs/alerta-desconto.md.
 *
 * Por que um arquivo no repo: quem lê o alerta depois (inclusive um agente na
 * nuvem) não tem as credenciais do Supabase. O Actions tem — então ele consulta
 * e deixa o resultado versionado, legível por qualquer um que clone o repo.
 *
 * Mesma regra do lib/discount-alerts.ts: só desconto de venda sem parceiro
 * conta; dias capturados antes da classificação por canal ficam de fora.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Espelham lib/discount-alerts.ts — se mudar lá, mudar aqui.
const LOOKBACK_DAYS = 14;
const PCT_ALERTA = 3;
const DIAS_RECORRENTE = 3;
const ACUMULADO_GRAVE = 500;

const LOJAS = { "49895": "Loja 1 (DLV)", "49897": "Loja 2 (LTDA)" };
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => Number(v ?? 0) || 0;

function spToday(offset = 0) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[alerta] faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const hoje = spToday(0);
  const ontem = spToday(-1);
  const inicio = spToday(-(LOOKBACK_DAYS - 1));

  const { data, error } = await supabase
    .from("saipos_daily_sales")
    .select("work_date, store_id, items_amount, manual_discount_amount, counter_discount_amount, web_discount_amount, partner_discount_amount")
    .gte("work_date", inicio)
    .lte("work_date", hoje)
    .order("work_date");
  if (error) {
    console.error(`[alerta] erro no banco: ${error.message}`);
    process.exit(1);
  }

  const linhas = [];
  const push = (l = "") => linhas.push(l);
  push(`# Alerta de desconto de balcão`);
  push();
  push(`Gerado em ${new Date().toISOString()} · janela ${inicio} → ${hoje}`);
  push();

  const classificados = (data || []).filter(
    (r) => !(num(r.counter_discount_amount) === 0 && num(r.web_discount_amount) === 0 && num(r.partner_discount_amount) === 0 && num(r.manual_discount_amount) > 0)
  );
  const semClassificacao = (data || []).length - classificados.length;

  // --- o dia de ontem, que é o que interessa no aviso da manhã ---
  const doDia = classificados.filter((r) => r.work_date === ontem);
  push(`## Ontem (${ontem})`);
  if (!doDia.length) {
    const bruto = (data || []).filter((r) => r.work_date === ontem);
    push(
      bruto.length
        ? `Capturado, mas sem classificação por canal — fora da conta.`
        : `**Sem dados.** Ou o restaurante não abriu, ou a captura falhou.`
    );
  } else {
    for (const r of doDia) {
      const itens = num(r.items_amount);
      const balcao = num(r.counter_discount_amount);
      const pct = itens > 0 ? (balcao / itens) * 100 : 0;
      push(
        `- **${LOJAS[r.store_id] ?? r.store_id}**: balcão ${brl(balcao)} (${pct.toFixed(1)}% do valor de menu)` +
          ` · web ${brl(r.web_discount_amount)} · parceiro ${brl(r.partner_discount_amount)}` +
          (pct >= PCT_ALERTA ? ` — **acima do limite de ${PCT_ALERTA}%**` : ` — dentro do limite`)
      );
    }
  }
  push();

  // --- estado do alerta na janela (mesma regra do painel) ---
  const porLoja = new Map();
  for (const r of classificados) {
    const agg = porLoja.get(r.store_id) || { acumulado: 0, itens: 0, diasAltos: 0, dias: 0 };
    const itens = num(r.items_amount);
    const balcao = num(r.counter_discount_amount);
    agg.acumulado += balcao;
    agg.itens += itens;
    agg.dias += 1;
    if (itens > 0 && (balcao / itens) * 100 >= PCT_ALERTA) agg.diasAltos += 1;
    porLoja.set(r.store_id, agg);
  }

  let disparou = false;
  push(`## Janela de ${LOOKBACK_DAYS} dias`);
  if (!porLoja.size) {
    push(`Sem dias classificados ainda — a série por canal começou em 11/08/2026.`);
  }
  for (const [store, a] of porLoja) {
    const recorrente = a.diasAltos >= DIAS_RECORRENTE;
    const grave = a.acumulado >= ACUMULADO_GRAVE;
    if (recorrente || grave) disparou = true;
    push(
      `- **${LOJAS[store] ?? store}**: ${brl(a.acumulado)} de balcão em ${a.dias} dia(s)` +
        ` · ${a.itens > 0 ? ((a.acumulado / a.itens) * 100).toFixed(1) : "0.0"}%` +
        ` · ${a.diasAltos} dia(s) acima de ${PCT_ALERTA}%` +
        (grave ? ` — **GRAVE**` : recorrente ? ` — **RECORRENTE**` : ` — ok`)
    );
  }
  push();
  if (semClassificacao) push(`_${semClassificacao} dia(s) da janela ficaram fora por serem anteriores à classificação por canal._`);
  push();
  push(`## Veredito`);
  push(disparou ? `**ALERTA DISPAROU** — ver detalhe acima.` : `**Não disparou.** Nenhuma loja recorrente ou grave.`);

  mkdirSync("docs", { recursive: true });
  writeFileSync("docs/alerta-desconto.md", linhas.join("\n") + "\n");
  console.log(linhas.join("\n"));
  console.log(`\n[alerta] disparou=${disparou}`);
}

main();
