#!/usr/bin/env node
// Importa extras de Maio/2026 que ficaram fora do import original (que parou em 15 de abril).
// Idempotente: pula linhas que já existem (mesmo employee_id + work_date + amount).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1).replace(/\\n/g, "").replace(/\\r/g, "");
      }
      return [k, v.trim()];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Dados confirmados pelo Diego (planilha original, Maio/2026)
const YEAR = 2026;
const ROWS = [
  // [dia_mes, nome, valor]
  ["2026-05-01", "Guilherme", 100],
  ["2026-05-02", "Guilherme", 100],
  ["2026-05-02", "Mateus Conte", 100],
  ["2026-05-03", "Guilherme", 100],
  ["2026-05-03", "Mateus Conte", 100],
  ["2026-05-05", "Thierry", 70],
  ["2026-05-06", "Thierry", 70],
  ["2026-05-07", "Thierry", 70],
  ["2026-05-08", "Guilherme", 100],
  ["2026-05-09", "Guilherme", 100],
  ["2026-05-10", "Himbert", 100],
  ["2026-05-10", "Guilherme", 100],
  ["2026-05-12", "Thierry", 70],
  ["2026-05-13", "Thierry", 70],
  ["2026-05-14", "Thierry", 70],
  ["2026-05-15", "Guilherme", 100],
  ["2026-05-16", "Guilherme", 100],
  ["2026-05-17", "Guilherme", 100],
  ["2026-05-19", "Thierry", 70],
  ["2026-05-20", "Thierry", 70],
  ["2026-05-21", "Thierry", 70],
  ["2026-05-22", "Guilherme", 100],
  ["2026-05-22", "Armando dono", 100],
  ["2026-05-23", "Guilherme", 100],
  ["2026-05-24", "Guilherme", 100],
];

// Carrega employees pra resolver nome → id
const { data: emps, error: empErr } = await supabase
  .from("employees")
  .select("id, name");
if (empErr) {
  console.error("Erro buscando employees:", empErr.message);
  process.exit(1);
}
const empByName = new Map(emps.map((e) => [e.name.toLowerCase(), e.id]));

const inserts = [];
const skipped = [];
const missing = [];

for (const [date, name, amount] of ROWS) {
  const id = empByName.get(name.toLowerCase());
  if (!id) {
    missing.push(name);
    continue;
  }

  // Idempotência: verifica se já existe (mesma data + employee + amount)
  const { data: existing } = await supabase
    .from("extra_payments")
    .select("id")
    .eq("employee_id", id)
    .eq("work_date", date)
    .eq("amount", amount)
    .maybeSingle();

  if (existing) {
    skipped.push(`${date} ${name}`);
    continue;
  }

  inserts.push({
    employee_id: id,
    work_date: date,
    amount,
    paid: true,
    paid_at: new Date(`${date}T12:00:00-03:00`).toISOString(),
    paid_by: null,
    paid_amount: null,
    notes: null,
    created_by: null,
  });
}

console.log(`A inserir: ${inserts.length}`);
console.log(`Já existiam: ${skipped.length}`);
if (missing.length) {
  console.log(`Nomes não encontrados:`, [...new Set(missing)]);
}

if (inserts.length > 0) {
  const { error } = await supabase.from("extra_payments").insert(inserts);
  if (error) {
    console.error("Erro:", error.message);
    process.exit(1);
  }
  console.log(`✓ ${inserts.length} extras de Maio/2026 inseridos.`);
}
