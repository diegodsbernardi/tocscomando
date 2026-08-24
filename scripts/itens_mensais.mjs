#!/usr/bin/env node
/**
 * Mix de produtos e valor de MENU por mês/loja — via itemsSold.
 *
 * Por que este endpoint: diferente do sales-by-period, o itemsSold aceita
 * janela de data livre (é o mesmo filtro que o robô diário já usa). Ele
 * devolve, por produto, quantidade e valor de tabela no período.
 *
 * Com isso dá pra:
 *   - somar o valor de MENU do mês (o que os itens valiam na tabela);
 *   - comparar com o valor RECEBIDO (sales-by-payment-type) — a diferença é
 *     desconto/promoção mais taxas, ou seja, quanto o mês "deu de desconto";
 *   - ver o mix: qual produto puxou o movimento naquele mês.
 *
 * Só leitura. Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_STORE_IDS,
 *                  MIX_INICIO / MIX_FIM (YYYY-MM), MIX_SAIDA, MIX_TOP.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const INICIO = process.env.MIX_INICIO || "2025-06";
const FIM =
  process.env.MIX_FIM ||
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);
const SAIDA = process.env.MIX_SAIDA || "mix-mensal.csv";
const TOP = Number(process.env.MIX_TOP || 8);

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v) => Number(String(v ?? 0).replace(",", ".")) || 0;

function meses(de, ate) {
  const out = [];
  let [y, m] = de.split("-").map(Number);
  const [yf, mf] = ate.split("-").map(Number);
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y += 1; }
  }
  return out;
}

function janela(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `01/${mm}/${y}`, end: `${ultimo}/${mm}/${y}` };
}

const filtroBase = (start, end) => ({
  start_date: start,
  end_date: end,
  exclude_canceled: 1,
  only_nfe: 0,
  id_store_shift: 0,
  id_sale_types: ["1", "2", "3", "4"],
  id_user_stores: null,
});

async function main() {
  const lista = meses(INICIO, FIM);
  const s = await openSaiposSession();
  const linhas = [];

  try {
    console.log(`[mix] ${s.storeIds.length} lojas x ${lista.length} meses\n`);
    for (const storeId of s.storeIds) {
      for (const ym of lista) {
        const { start, end } = janela(ym);
        const f = encodeURIComponent(JSON.stringify(filtroBase(start, end)));

        let menu = 0;
        let qtd = 0;
        let itens = [];
        let recebido = 0;
        let vendas = 0;

        try {
          const j = await s.get(storeId, `itemsSold?filter=${f}`);
          itens = (j?.items || []).map((i) => ({
            nome: i.desc_item,
            qtd: num(i.total_qtt),
            valor: num(i.total_value),
          }));
          menu = itens.reduce((a, i) => a + i.valor, 0);
          qtd = itens.reduce((a, i) => a + i.qtd, 0);
        } catch (e) {
          console.log(`  loja ${storeId} · ${ym} · itemsSold ERRO ${e.message.slice(0, 80)}`);
        }

        try {
          const rows = await s.get(storeId, `sales-by-payment-type?filter=${f}`);
          const arr = Array.isArray(rows) ? rows : [];
          recebido = arr.length ? num(arr[0].total_saled) : 0;
          vendas = arr.length ? num(arr[0].count_sales) : 0;
        } catch (e) {
          console.log(`  loja ${storeId} · ${ym} · pagamento ERRO ${e.message.slice(0, 80)}`);
        }

        // Diferença entre o que os itens valiam na tabela e o que entrou.
        // Positiva = desconto/promoção; negativa = taxa de entrega e serviço
        // somando por cima do menu (típico do delivery).
        const gap = menu - recebido;
        const pct = menu ? (gap / menu) * 100 : 0;

        const top = itens.sort((a, b) => b.qtd - a.qtd).slice(0, TOP);
        linhas.push({ storeId, ym, menu, recebido, gap, pct, qtd, vendas, top });

        console.log(
          `  loja ${storeId} · ${ym} · menu ${brl(menu).padStart(13)} · recebido ${brl(recebido).padStart(13)} · gap ${brl(gap).padStart(12)} (${pct.toFixed(1).padStart(5)}%) · ${String(qtd).padStart(5)} itens`,
        );
        console.log(`      top: ${top.slice(0, 5).map((i) => `${i.nome} ${i.qtd}`).join(" · ")}`);
        await new Promise((r) => setTimeout(r, 700));
      }
      console.log("");
    }
  } finally {
    await s.close();
  }

  const csv = ["loja;mes;valor_menu;valor_recebido;gap;pct_gap;itens_vendidos;vendas;" +
    Array.from({ length: TOP }, (_, i) => `top${i + 1}`).join(";")];
  for (const r of linhas) {
    csv.push(
      [
        r.storeId, r.ym, r.menu.toFixed(2), r.recebido.toFixed(2), r.gap.toFixed(2),
        r.pct.toFixed(2), r.qtd, r.vendas,
        ...Array.from({ length: TOP }, (_, i) => (r.top[i] ? `${r.top[i].nome} (${r.top[i].qtd})` : "")),
      ].join(";"),
    );
  }
  writeFileSync(SAIDA, csv.join("\n") + "\n", "utf8");
  console.log(`[mix] CSV salvo em ${SAIDA}`);
}

main().catch((e) => {
  console.error("[mix] falhou:", e);
  process.exit(1);
});
