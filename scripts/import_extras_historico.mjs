#!/usr/bin/env node
// Importa o histórico de pagamentos de extras (Dez/2025 → Abr/2026)
// da planilha original do Sheets para o Supabase.
//
// Uso:
//   cd /home/diego/tocscomando
//   node scripts/import_extras_historico.mjs
//
// Requer SUPABASE_SERVICE_ROLE_KEY em .env.local.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------- env ----------
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) {
        v = v.slice(1, -1).replace(/\\n/g, "").replace(/\\r/g, "").replace(/\\\\/g, "\\");
      }
      return [k, v.trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ---------- dados da planilha ----------
// Cada item: [diaPt, nomePt, valorStr, situacao, valorPagoStr, centroCusto]
// `null` representa célula vazia.
const ROWS = [
  ["sábado, 13 de dezembro", "mateus conte", "100", "PAGO", "100", "Atendimento"],
  ["sábado, 13 de dezembro", "Maria Henicka", "100", "PAGO", "100", "Atendimento"],
  ["sábado, 13 de dezembro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 13 de dezembro", "Armando", "100", "PAGO", null, null],
  ["domingo, 14 de dezembro", "Armando", "100", "PAGO", null, null],
  ["domingo, 14 de dezembro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["domingo, 14 de dezembro", "Himbert", "100", "PAGO", null, "Cozinha"],
  ["terça-feira, 16 de dezembro", "Himbert", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 16 de dezembro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 17 de dezembro", "Himbert", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 17 de dezembro", "Maria Henicka", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 17 de dezembro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 17 de dezembro", "MARIA J", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 18 de dezembro", "Himbert", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 18 de dezembro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 18 de dezembro", "Maria Henicka", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 18 de dezembro", "MARIA J", "70", "PAGO", null, "Cozinha"],
  ["sexta-feira, 19 de dezembro", "Sara", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 19 de dezembro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 19 de dezembro", "Himbert", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 19 de dezembro", "MARIA J", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 19 de dezembro", "Indianara", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 19 de dezembro", "Armando", "100", "PAGO", null, null],
  ["sexta-feira, 19 de dezembro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 19 de dezembro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 19 de dezembro", "claudio", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 19 de dezembro", "elô", "100", "PAGO", null, "Atendimento"],
  ["sábado, 20 de dezembro", "Sara", "100", "PAGO", "100", "Atendimento"],
  ["sábado, 20 de dezembro", "Ivony", "100", "PAGO", null, "Cozinha"],
  ["sábado, 20 de dezembro", "Indianara", "100", "PAGO", null, "Cozinha"],
  ["sábado, 20 de dezembro", "MARIA J", "100", "PAGO", null, "Cozinha"],
  ["sábado, 20 de dezembro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 20 de dezembro", "Himbert", "100", "PAGO", null, "Cozinha"],
  ["sábado, 20 de dezembro", "Maria Henicka", "100", "PAGO", null, "Atendimento"],
  ["sábado, 20 de dezembro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sábado, 20 de dezembro", "claudio", "100", "PAGO", null, "Atendimento"],
  ["sábado, 20 de dezembro", "eduardo jose", "100", "PAGO", null, "Atendimento"],
  ["sábado, 20 de dezembro", "eloir", "100", "PAGO", null, "Atendimento"],
  ["sábado, 20 de dezembro", "Armando", "100", "PAGO", null, null],
  ["sábado, 20 de dezembro", "guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 21 de dezembro", "Maria Henicka", "100", "PAGO", null, "Atendimento"],
  ["domingo, 21 de dezembro", "Sara", "100", "PAGO", null, "Atendimento"],
  ["domingo, 21 de dezembro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["domingo, 21 de dezembro", "claudio", "100", "PAGO", null, "Atendimento"],
  ["domingo, 21 de dezembro", "MARIA J", "100", "PAGO", null, "Cozinha"],
  ["domingo, 21 de dezembro", "Indianara", "100", "PAGO", null, "Cozinha"],
  ["domingo, 21 de dezembro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["domingo, 21 de dezembro", "Himbert", "100", "PAGO", null, "Cozinha"],
  ["domingo, 21 de dezembro", "eduardo jose", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 2 de janeiro", "Himbert", "100", "PAGO", "100", "Cozinha"],
  ["sexta-feira, 2 de janeiro", "MARIA J", "100", "PAGO", "100", "Cozinha"],
  ["sexta-feira, 2 de janeiro", "Armando", "100", "NÃO PAGO", null, null],
  ["sexta-feira, 2 de janeiro", "Renata", "100", "PAGO", "100", "Atendimento"],
  ["sexta-feira, 2 de janeiro", "Guilherme", "100", "NÃO PAGO", null, "Atendimento"],
  ["sexta-feira, 2 de janeiro", "Alisson", "100", "PAGO", "100", "Atendimento"],
  ["sexta-feira, 2 de janeiro", "mateus conte", "100", "PAGO", "100", "Atendimento"],
  ["sábado, 3 de janeiro", "Rosimary", "100", "PAGO", "ARMANDO FEZ PIX", "Cozinha"],
  ["sábado, 3 de janeiro", "Himbert", "100", "PAGO", "100", "Cozinha"],
  ["sábado, 3 de janeiro", "MARIA J", "100", "PAGO", "100", "Cozinha"],
  ["sábado, 3 de janeiro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sábado, 3 de janeiro", "Alisson", "100", "PAGO", null, "Atendimento"],
  ["sábado, 3 de janeiro", "eduardo jose", "100", "PAGO", null, "Atendimento"],
  ["sábado, 3 de janeiro", "Alejandro", "100", "PAGO", "100", "Cozinha"],
  ["sábado, 3 de janeiro", "Armando", "100", "NÃO PAGO", null, null],
  ["domingo, 4 de janeiro", "Rosimary", "100", "PAGO", null, "Cozinha"],
  ["domingo, 4 de janeiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 4 de janeiro", "Himbert", "100", "PAGO", null, "Cozinha"],
  ["domingo, 4 de janeiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["domingo, 4 de janeiro", "MARIA J", "100", "PAGO", null, "Cozinha"],
  ["domingo, 4 de janeiro", "Alisson", "100", "PAGO", null, "Atendimento"],
  ["domingo, 4 de janeiro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["domingo, 4 de janeiro", "eduardo jose", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 6 de janeiro", "MARIA J", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 6 de janeiro", "Himbert", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 6 de janeiro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 6 de janeiro", "Alisson", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 7 de janeiro", "MARIA J", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 7 de janeiro", "Alisson", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 8 de janeiro", "Armando", "70", "PAGO", null, null],
  ["quinta-feira, 8 de janeiro", "MARIA J", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 8 de janeiro", "ana paula", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 8 de janeiro", "Alisson", "70", "PAGO", null, "Atendimento"],
  ["sexta-feira, 9 de janeiro", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 9 de janeiro", "MARIA J", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 9 de janeiro", "Alisson", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 9 de janeiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["sábado, 10 de janeiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 10 de janeiro", "Josimary", "100", "PAGO", null, "Cozinha"],
  ["sábado, 10 de janeiro", "MARIA J", "100", "PAGO", null, "Cozinha"],
  ["domingo, 11 de janeiro", "MARIA J", "100", "PAGO", null, "Cozinha"],
  ["domingo, 11 de janeiro", "Josimary", "100", "PAGO", null, "Cozinha"],
  ["domingo, 11 de janeiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["terça-feira, 13 de janeiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 13 de janeiro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 13 de janeiro", "ana paula", "70", "PAGO", null, "Atendimento"],
  ["terça-feira, 13 de janeiro", "Alisson", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 14 de janeiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 14 de janeiro", "ana paula", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 14 de janeiro", "Alisson", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 15 de janeiro", "Alisson", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 15 de janeiro", "ana paula", "70", "PAGO", null, "Atendimento"],
  ["sexta-feira, 16 de janeiro", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 16 de janeiro", "Sara Los", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 16 de janeiro", "Alisson", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 16 de janeiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["sábado, 17 de janeiro", "Jesus", "100", "PAGO", null, "Cozinha"],
  ["sábado, 17 de janeiro", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["domingo, 18 de janeiro", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["domingo, 18 de janeiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 18 de janeiro", "Alisson", "100", "PAGO", null, "Atendimento"],
  ["domingo, 18 de janeiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["domingo, 18 de janeiro", "Alex Ebisu", "100", "PAGO", null, "Atendimento"],
  ["domingo, 18 de janeiro", "aneli", "100", "PAGO", null, "Cozinha"],
  ["terça-feira, 20 de janeiro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 20 de janeiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 20 de janeiro", "Alisson", "70", "PAGO", null, "Atendimento"],
  ["terça-feira, 20 de janeiro", "ana paula", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 21 de janeiro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 21 de janeiro", "ana paula", "70", null, null, "Atendimento"],
  ["quinta-feira, 22 de janeiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 22 de janeiro", "ana paula", "70", null, null, "Atendimento"],
  ["sexta-feira, 23 de janeiro", "Sara Los", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 23 de janeiro", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 23 de janeiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 23 de janeiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["sábado, 24 de janeiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 24 de janeiro", "Sara Los", "100", "PAGO", null, "Cozinha"],
  ["sábado, 24 de janeiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["sábado, 24 de janeiro", "eduardo jose", "100", "PAGO", null, "Atendimento"],
  ["sábado, 24 de janeiro", "claudio", "100", "PAGO", null, "Atendimento"],
  ["domingo, 25 de janeiro", "Josimary", "100", "PAGO", null, "Cozinha"],
  ["domingo, 25 de janeiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["domingo, 25 de janeiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["domingo, 25 de janeiro", "claudio", "100", "PAGO", null, "Atendimento"],
  ["domingo, 25 de janeiro", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["terça-feira, 27 de janeiro", "ana paula", "70", "PAGO", null, "Atendimento"],
  ["terça-feira, 27 de janeiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 28 de janeiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 28 de janeiro", "ana paula", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 29 de janeiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 29 de janeiro", "ana paula", "70", "PAGO", "140", "Atendimento"],
  ["sexta-feira, 30 de janeiro", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 30 de janeiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 30 de janeiro", "ana paula", null, "PAGO", null, "Atendimento"],
  ["sábado, 31 de janeiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 31 de janeiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["sábado, 31 de janeiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 31 de janeiro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["domingo, 1 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["domingo, 1 de fevereiro", "ana paula", "100", "PAGO", null, "Atendimento"],
  ["domingo, 1 de fevereiro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["domingo, 1 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["quarta-feira, 4 de fevereiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 5 de fevereiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["sexta-feira, 6 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 6 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 7 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 7 de fevereiro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sábado, 7 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 8 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["domingo, 8 de fevereiro", "mateus conte", "100", null, null, "Atendimento"],
  ["domingo, 8 de fevereiro", "Guilherme", "100", null, null, "Atendimento"],
  ["quarta-feira, 11 de fevereiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 12 de fevereiro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["sexta-feira, 13 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 13 de fevereiro", "Angel", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 13 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 14 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 14 de fevereiro", "Angel", "100", "PAGO", null, "Cozinha"],
  ["domingo, 15 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 15 de fevereiro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 17 de fevereiro", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 18 de fevereiro", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["sexta-feira, 20 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 20 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 21 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 21 de fevereiro", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 21 de fevereiro", "mateus conte", "100", null, null, "Atendimento"],
  ["sábado, 21 de fevereiro", "Yelique", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 27 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 28 de fevereiro", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sábado, 28 de fevereiro", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 1 de março", "John", "100", "PAGO", null, "Cozinha"],
  ["domingo, 1 de março", "belquis", "100", "PAGO", null, "Cozinha"],
  ["domingo, 1 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["quarta-feira, 4 de março", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["sexta-feira, 6 de março", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 6 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 6 de março", "Yelique", "100", "PAGO", null, "Cozinha"],
  ["sábado, 7 de março", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["sábado, 7 de março", "Yelique", "100", "PAGO", null, "Cozinha"],
  ["sábado, 7 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 7 de março", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["domingo, 8 de março", "Alejandro", "100", "PAGO", null, "Cozinha"],
  ["domingo, 8 de março", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["domingo, 8 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 10 de março", "Alejandro", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 10 de março", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 10 de março", "Guilherme", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 11 de março", "Guilherme", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 12 de março", "John", "70", "PAGO", null, "Cozinha"],
  ["quinta-feira, 12 de março", "Guilherme", "70", "PAGO", null, "Atendimento"],
  ["sexta-feira, 13 de março", "John", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 13 de março", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 13 de março", "Guilherme", "100", "NÃO PAGO", null, "Atendimento"],
  ["sexta-feira, 13 de março", "Thierry", "100", "NÃO PAGO", null, "Atendimento"],
  ["sábado, 14 de março", "John", "100", "PAGO", null, "Cozinha"],
  ["sábado, 14 de março", "claudio", "100", "PAGO", null, "Atendimento"],
  ["sábado, 14 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 14 de março", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["domingo, 15 de março", "Armando dono", "100", "PAGO", null, "Cozinha"],
  ["domingo, 15 de março", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["domingo, 15 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 17 de março", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 18 de março", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 18 de março", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 19 de março", "Armando dono", "70", "PAGO", null, "Cozinha"],
  ["sexta-feira, 20 de março", "Henrqiue", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 20 de março", "Roberta", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 20 de março", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 20 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 21 de março", "Henrqiue", "100", "PAGO", null, "Cozinha"],
  ["sábado, 21 de março", "Roberta", "100", "PAGO", null, "Cozinha"],
  ["sábado, 21 de março", "claudio", "100", "PAGO", null, "Atendimento"],
  ["sábado, 21 de março", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["sábado, 21 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 22 de março", "Henrqiue", "100", "PAGO", null, "Cozinha"],
  ["domingo, 22 de março", "claudio", "100", "PAGO", null, "Atendimento"],
  ["domingo, 22 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 22 de março", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 24 de março", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 25 de março", "Hecmary", "70", "PAGO", null, "Cozinha"],
  ["quarta-feira, 25 de março", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["sexta-feira, 27 de março", "Hecmary", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 27 de março", "Henrqiue", "100", "PAGO", null, "Cozinha"],
  ["sexta-feira, 27 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 27 de março", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["sábado, 28 de março", "Hecmary", "100", "PAGO", null, "Cozinha"],
  ["sábado, 28 de março", "Henrqiue", "100", "PAGO", null, "Cozinha"],
  ["sábado, 28 de março", "claudio", "100", "PAGO", null, "Atendimento"],
  ["sábado, 28 de março", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sábado, 28 de março", "eduardo jose", "100", "PAGO", null, "Atendimento"],
  ["domingo, 29 de março", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 29 de março", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 31 de março", "Henrqiue", "70", "PAGO", null, "Cozinha"],
  ["terça-feira, 31 de março", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 1 de abril", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 2 de abril", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["sexta-feira, 3 de abril", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["sábado, 4 de abril", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["sábado, 4 de abril", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 7 de abril", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 8 de abril", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["quinta-feira, 9 de abril", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["sexta-feira, 10 de abril", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["sexta-feira, 10 de abril", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 11 de abril", "mateus conte", "100", "PAGO", null, "Atendimento"],
  ["sábado, 11 de abril", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["sábado, 11 de abril", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["domingo, 12 de abril", "Guilherme", "100", "PAGO", null, "Atendimento"],
  ["domingo, 12 de abril", "Thierry", "100", "PAGO", null, "Atendimento"],
  ["terça-feira, 14 de abril", "Thierry", "70", "PAGO", null, "Atendimento"],
  ["terça-feira, 14 de abril", "Maria Henicka", "70", "PAGO", null, "Atendimento"],
  ["quarta-feira, 15 de abril", "Thierry", "70", "PAGO", null, "Atendimento"],
];

// ---------- normalização de nomes ----------
// Mapeia variantes da planilha → nome canônico no cadastro `employees`.
const NAME_ALIASES = {
  "armando": "Armando dono",
  "henrqiue": "Henrique",
  "claudio": "Claudio",
  "elô": "Elô",
  "eloir": "Eloir",
  "ana paula": "Ana Paula",
  "ivony": "Ivony",
  "guilherme": "Guilherme",
  "alejandro": "Alejandro",
  "mateus conte": "Mateus Conte",
  "eduardo jose": "Eduardo Jose",
  "aneli": "Aneli",
  "belquis": "Belquis",
  "maria j": "Maria J",
  "maria henicka": "Maria Henicka",
  "sara los": "Sara Los",
  "sara": "Sara",
  "indianara": "Indianara",
  "himbert": "Himbert",
  "josimary": "Josimary",
  "rosimary": "Rosimary",
  "alisson": "Alisson",
  "renata": "Renata",
  "armando dono": "Armando dono",
  "alex ebisu": "Alex Ebisu",
  "yelique": "Yelique",
  "john": "John",
  "angel": "Angel",
  "jesus": "Jesus",
  "thierry": "Thierry",
  "hecmary": "Hecmary",
  "henrique": "Henrique",
  "roberta": "Roberta",
};

function canonName(raw) {
  return NAME_ALIASES[raw.trim().toLowerCase()] ?? raw.trim();
}

// ---------- parser de data pt-BR ----------
const MONTHS = {
  "janeiro": 0, "fevereiro": 1, "março": 2, "abril": 3, "maio": 4, "junho": 5,
  "julho": 6, "agosto": 7, "setembro": 8, "outubro": 9, "novembro": 10, "dezembro": 11,
};

function parseDate(diaPt, idx, prevMonth, prevYear) {
  // Ex: "sábado, 13 de dezembro"
  const after = diaPt.split(",").slice(1).join(",").trim(); // "13 de dezembro"
  const m = after.match(/^(\d+)\s+de\s+(\S+)$/i);
  if (!m) throw new Error(`Não consegui parsear: "${diaPt}"`);
  const day = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase().normalize("NFC");
  if (!(monthName in MONTHS)) throw new Error(`Mês desconhecido: "${monthName}"`);
  const month = MONTHS[monthName];

  // Inferência de ano: começamos em 2025 se primeiro mês for Dez,
  // e somamos 1 sempre que o mês "diminui" (Dez → Jan).
  let year = prevYear;
  if (idx === 0) {
    year = month === 11 ? 2025 : 2026;
  } else if (month < prevMonth) {
    year = prevYear + 1;
  }

  return { iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`, month, year };
}

// ---------- main ----------
async function main() {
  // Guard: aborta se já existirem registros (evita duplicar em re-execuções)
  const { count, error: countErr } = await supabase
    .from("extra_payments")
    .select("*", { count: "exact", head: true });
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) {
    console.error(`extra_payments já tem ${count} registros. Aborta pra evitar duplicar.`);
    console.error("Pra re-importar: TRUNCATE public.extra_payments no Supabase e roda de novo.");
    process.exit(1);
  }

  // Carrega lookup de employees por lower(name)
  const { data: emps, error: empErr } = await supabase
    .from("employees")
    .select("id, name");
  if (empErr) throw empErr;
  const empByName = new Map(emps.map((e) => [e.name.toLowerCase(), e.id]));

  // Processa linhas e monta inserts
  const inserts = [];
  let prevMonth = -1, prevYear = 2025;
  let skipped = 0;
  const missingNames = new Set();

  for (let i = 0; i < ROWS.length; i++) {
    const [diaPt, nomeRaw, valorStr, situacao, valorPago, centro] = ROWS[i];

    if (!valorStr) {
      // sem valor combinado → pula (linha "ana paula" 30 jan sem valor)
      skipped++;
      continue;
    }

    const { iso, month, year } = parseDate(diaPt, i, prevMonth, prevYear);
    prevMonth = month; prevYear = year;

    const nome = canonName(nomeRaw);
    const employeeId = empByName.get(nome.toLowerCase());
    if (!employeeId) {
      missingNames.add(nome);
      skipped++;
      continue;
    }

    // SITUAÇÃO: PAGO | NÃO PAGO | null
    const paid = situacao === "PAGO";

    // VALOR PAGO: numérico = paid_amount; texto = notes; vazio = null
    let paid_amount = null;
    let notes = null;
    if (valorPago) {
      const asNum = Number(valorPago);
      if (Number.isFinite(asNum) && !Number.isNaN(asNum)) {
        paid_amount = asNum;
      } else {
        notes = valorPago;
      }
    }

    inserts.push({
      employee_id: employeeId,
      work_date: iso,
      amount: Number(valorStr),
      paid,
      paid_amount,
      paid_at: paid ? new Date(`${iso}T12:00:00-03:00`).toISOString() : null,
      paid_by: null,
      notes,
      created_by: null,
    });
  }

  console.log(`Linhas processadas: ${ROWS.length}`);
  console.log(`A inserir: ${inserts.length}`);
  console.log(`Puladas: ${skipped}`);
  if (missingNames.size > 0) {
    console.log("Nomes não encontrados no cadastro (puladas):", [...missingNames]);
  }

  if (inserts.length === 0) {
    console.log("Nada pra inserir.");
    return;
  }

  // Bulk insert em chunks de 100
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { error } = await supabase.from("extra_payments").insert(chunk);
    if (error) {
      console.error(`Erro no chunk ${i / CHUNK + 1}:`, error.message);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`  inserido: ${inserted}/${inserts.length}`);
  }

  console.log(`✓ Importação concluída: ${inserted} registros.`);
}

main().catch((e) => {
  console.error("Falhou:", e.message ?? e);
  process.exit(1);
});
