#!/usr/bin/env node
/**
 * Rastreia um PARCEIRO DE VENDA (clube de desconto, marketplace) mês a mês.
 *
 * O parceiro não aparece como forma de pagamento — o cliente paga no cartão
 * normal e o desconto entra na venda. Então o caminho é filtrar o relatório
 * por parceiro. Este script:
 *   1. procura o cadastro de parceiros da loja em alguns paths conhecidos;
 *   2. com o id em mãos, roda o relatório de pagamento mês a mês filtrando
 *      por aquele parceiro, e compara com o total do mês.
 *
 * Só leitura. Env: SAIPOS_USER, SAIPOS_PASS, SAIPOS_STORE_IDS,
 *                  PARC_NOME (default "abra"), PARC_INICIO / PARC_FIM.
 */

import { writeFileSync } from "node:fs";
import { openSaiposSession } from "./lib/saipos_session.mjs";

const TZ = "America/Sao_Paulo";
const ALVO = (process.env.PARC_NOME || "abra").toLowerCase();
const INICIO = process.env.PARC_INICIO || "2025-04";
const FIM =
  process.env.PARC_FIM ||
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()).slice(0, 7);

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

const PATHS_PARCEIRO = [
  "store-partner-sales",
  "partner-sales",
  "partners",
  "store-partners",
  "sale-partners",
  "discount-coupons",
  "store-discount-coupons",
];

async function main() {
  const s = await openSaiposSession();
  const achados = [];

  try {
    const storeId = s.storeIds[0];

    console.log("== procurando cadastro de parceiros ==");
    for (const p of PATHS_PARCEIRO) {
      try {
        const j = await s.get(storeId, p);
        const arr = Array.isArray(j) ? j : j?.rows || j?.items || [];
        console.log(`  ${p.padEnd(26)} OK · ${arr.length} registro(s)`);
        for (const r of arr.slice(0, 40)) {
          const nome = r.desc_partner_sale || r.desc_store_partner_sale || r.name || r.desc_discount_coupon || JSON.stringify(r).slice(0, 60);
          const id = r.id_store_partner_sale ?? r.id_partner_sale ?? r.id ?? "?";
          console.log(`      id=${id} · ${nome}`);
          if (String(nome).toLowerCase().includes(ALVO)) achados.push({ path: p, id, nome, bruto: r });
        }
      } catch (e) {
        console.log(`  ${p.padEnd(26)} — ${e.message.slice(0, 60)}`);
      }
    }

    if (achados.length === 0) {
      console.log(`\n[parc] nenhum parceiro com "${ALVO}" no nome. Nada a rastrear.`);
      return;
    }

    const alvo = achados[0];
    console.log(`\n[parc] rastreando: ${alvo.nome} (id ${alvo.id}, de ${alvo.path})`);
    console.log(`[parc] cadastro completo: ${JSON.stringify(alvo.bruto).slice(0, 400)}\n`);

    const linhas = [];
    for (const store of s.storeIds) {
      console.log(`== loja ${store} ==`);
      for (const ym of meses(INICIO, FIM)) {
        const { start, end } = janela(ym);
        const base = {
          start_date: start, end_date: end, exclude_canceled: 1, only_nfe: 0,
          id_store_shift: 0, id_sale_types: ["1", "2", "3", "4"], id_user_stores: null,
        };
        const enc = (o) => encodeURIComponent(JSON.stringify(o));
        let total = 0, vendas = 0, totalP = 0, vendasP = 0;
        try {
          const g = await s.get(store, `sales-by-payment-type?filter=${enc(base)}`);
          const a = Array.isArray(g) ? g : [];
          total = a.length ? num(a[0].total_saled) : 0;
          vendas = a.length ? num(a[0].count_sales) : 0;
        } catch {}
        try {
          const g = await s.get(store, `sales-by-payment-type?filter=${enc({ ...base, id_store_partner_sale: [String(alvo.id)] })}`);
          const a = Array.isArray(g) ? g : [];
          totalP = a.length ? num(a[0].total_saled) : 0;
          vendasP = a.length ? num(a[0].count_sales) : 0;
        } catch (e) {
          console.log(`    ${ym} filtro por parceiro falhou: ${e.message.slice(0, 60)}`);
        }
        const pct = total ? (totalP / total) * 100 : 0;
        linhas.push({ store, ym, total, vendas, totalP, vendasP, pct });
        console.log(`  ${ym} · parceiro ${brl(totalP).padStart(12)} em ${String(vendasP).padStart(4)} vendas · ${pct.toFixed(1).padStart(5)}% do faturamento (total ${brl(total)})`);
        await new Promise((r) => setTimeout(r, 500));
      }
      console.log("");
    }
    writeFileSync(
      "parceiro-historico.csv",
      ["loja;mes;total;vendas;parceiro_valor;parceiro_vendas;pct"]
        .concat(linhas.map((l) => `${l.store};${l.ym};${l.total.toFixed(2)};${l.vendas};${l.totalP.toFixed(2)};${l.vendasP};${l.pct.toFixed(2)}`))
        .join("\n") + "\n",
      "utf8",
    );
    console.log("[parc] CSV salvo em parceiro-historico.csv");
  } finally {
    await s.close();
  }
}

main().catch((e) => {
  console.error("[parc] falhou:", e);
  process.exit(1);
});
