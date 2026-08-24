#!/usr/bin/env node
/**
 * Relatório semanal de motoboys → WhatsApp.
 *
 * Fecha a semana (segunda a domingo) de turnos em public.motoboy_shifts +
 * motoboy_shift_rides, aplica o piso de R$100/dia e manda o resumo pelo
 * serviço Baileys local (o mesmo que o bot de ponto usa).
 *
 * Env:
 *   MOTOBOYS_INICIO / MOTOBOYS_FIM  — YYYY-MM-DD; default = semana passada
 *   MOTOBOYS_DESTINO                — id do grupo/número no WhatsApp
 *   WHATSAPP_URL                    — default http://127.0.0.1:8787/enviar
 *   DRY_RUN=1                       — imprime no terminal, não envia
 */
import { createClient } from "@supabase/supabase-js";
import { lerEnvLocal } from "./lib/env_local.mjs";

const MIN_DIARIO = 100; // espelha MIN_DAILY_PAYMENT em lib/motoboys.ts
const TZ = "America/Sao_Paulo";
const DRY_RUN = process.env.DRY_RUN === "1";
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const env = lerEnvLocal();
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const br = (iso) => iso.split("-").reverse().join("/");

/** Segunda a domingo da semana anterior, no fuso do restaurante. */
function semanaPassada() {
  const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const d = new Date(`${hojeSP}T12:00:00Z`);
  const diasDesdeSegunda = (d.getUTCDay() + 6) % 7;
  const fim = new Date(d);
  fim.setUTCDate(d.getUTCDate() - diasDesdeSegunda - 1); // domingo passado
  const inicio = new Date(fim);
  inicio.setUTCDate(fim.getUTCDate() - 6); // segunda passada
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

const periodo = process.env.MOTOBOYS_INICIO
  ? { inicio: process.env.MOTOBOYS_INICIO, fim: process.env.MOTOBOYS_FIM || process.env.MOTOBOYS_INICIO }
  : semanaPassada();

const sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

const { data, error } = await sb
  .from("motoboy_shifts")
  .select(
    "id, work_date, motoboy_id, paid, motoboys(name), rides:motoboy_shift_rides(rides_count, fee_at_time, delivery_areas(name))"
  )
  .gte("work_date", periodo.inicio)
  .lte("work_date", periodo.fim)
  .order("work_date");

if (error) {
  console.error("Falha ao consultar turnos:", error.message);
  process.exit(1);
}

const turnos = (data || []).map((s) => {
  const corridas = s.rides.reduce((a, r) => a + Number(r.rides_count), 0);
  const bruto = s.rides.reduce((a, r) => a + Number(r.rides_count) * Number(r.fee_at_time), 0);
  return {
    data: s.work_date,
    nome: s.motoboys?.name || "—",
    pago: s.paid,
    corridas,
    bruto,
    efetivo: Math.max(bruto, MIN_DIARIO),
    piso: Math.max(0, MIN_DIARIO - bruto),
    bairros: s.rides.filter((r) => r.rides_count > 0).map((r) => ({ nome: r.delivery_areas?.name || "—", n: Number(r.rides_count) })),
  };
});

function montarTexto() {
  const cab = `🏍️ *Motoboys — ${br(periodo.inicio)} a ${br(periodo.fim)}*`;
  if (turnos.length === 0) return `${cab}\n\nNenhum turno lançado no período.`;

  const soma = (f) => turnos.reduce((a, t) => a + f(t), 0);
  const totCorridas = soma((t) => t.corridas);
  const totPagar = soma((t) => t.efetivo);
  const totPiso = soma((t) => t.piso);

  const nomes = [...new Set(turnos.map((t) => t.nome))];
  const porNome = nomes
    .map((n) => {
      const ts = turnos.filter((t) => t.nome === n);
      return {
        nome: n,
        dias: ts.length,
        corridas: ts.reduce((a, t) => a + t.corridas, 0),
        pagar: ts.reduce((a, t) => a + t.efetivo, 0),
        piso: ts.reduce((a, t) => a + t.piso, 0),
      };
    })
    .sort((a, b) => b.pagar - a.pagar);

  const dias = [...new Set(turnos.map((t) => t.data))].sort();
  const porDia = dias.map((dia) => {
    const ts = turnos.filter((t) => t.data === dia);
    const dt = new Date(`${dia}T12:00:00Z`);
    return `${br(dia).slice(0, 5)} ${DIAS[dt.getUTCDay()]} · ${ts.length} moto${ts.length > 1 ? "s" : ""} · ${ts.reduce((a, t) => a + t.corridas, 0)} corr · ${brl(ts.reduce((a, t) => a + t.efetivo, 0))}`;
  });

  const bairros = {};
  turnos.flatMap((t) => t.bairros).forEach((b) => (bairros[b.nome] = (bairros[b.nome] || 0) + b.n));
  const topBairros = Object.entries(bairros)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n, q]) => `${n} ${q}`)
    .join(" · ");

  const naoPagos = turnos.filter((t) => !t.pago);

  const linhas = [
    cab,
    "",
    `*A PAGAR: ${brl(totPagar)}*`,
    `${totCorridas} corridas · ${turnos.length} turnos · ${nomes.length} motoboys`,
    `Custo/corrida ${brl(totPagar / (totCorridas || 1))} · piso complementado ${brl(totPiso)}`,
    "",
    "*Por motoboy*",
    ...porNome.map(
      (p) =>
        `• ${p.nome}: ${brl(p.pagar)} — ${p.corridas} corr em ${p.dias}d (${(p.corridas / p.dias).toFixed(1)}/dia)${p.piso > 0 ? ` · piso ${brl(p.piso)}` : ""}`
    ),
    "",
    "*Por dia*",
    ...porDia.map((l) => `• ${l}`),
    "",
    `*Top bairros:* ${topBairros}`,
  ];

  if (naoPagos.length) {
    linhas.push("", `⚠️ ${naoPagos.length} turno(s) ainda marcados como NÃO PAGOS (${brl(naoPagos.reduce((a, t) => a + t.efetivo, 0))}) — baixar em tocs.vercel.app/motoboys`);
  }

  return linhas.join("\n");
}

const texto = montarTexto();

if (DRY_RUN) {
  console.log("\n" + texto + "\n");
  process.exit(0);
}

const destino = process.env.MOTOBOYS_DESTINO;
if (!destino) {
  console.error("MOTOBOYS_DESTINO não configurado.");
  process.exit(1);
}

const url = process.env.WHATSAPP_URL || "http://127.0.0.1:8787/enviar";
const r = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ para: destino, texto }),
});
if (!r.ok) {
  console.error(`Envio falhou: HTTP ${r.status} ${await r.text()}`);
  process.exit(1);
}
console.log(`[${new Date().toISOString()}] Relatório ${periodo.inicio}..${periodo.fim} enviado para ${destino}.`);
