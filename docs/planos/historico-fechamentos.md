# Plano: Histórico de fechamentos (/fechamentos)

> **Como usar**: abra uma sessão de Claude Code em `~/tocscomando` e mande: *"executa o plano docs/planos/historico-fechamentos.md"*.
> **Leia primeiro** `docs/planos/_convencoes.md` — regras do repo, SQL via Management API e aprovações obrigatórias do Diego.

## Problema

O botão "Concluir" do wizard `/fechar-o-dia` grava um registro por dia em `day_closures` (totais de motoboys, extras, caixa, quebra, cartões, quem fechou) — mas **nenhuma tela mostra esses registros**. O histórico auditável existe no banco e não rende nada na UI.

## O que já existe (reusar, não recriar)

- Tabela `day_closures` (supabase/migration_dia_sugestoes.sql): `work_date` (unique), `closed_by`, `closed_by_name`, `moto_total`, `extras_pagos`, `extras_pendentes`, `cash_total`, `cash_diff`, `card_total`, `created_at`, `updated_at`. RLS: authenticated lê; insert/update pelo app.
- Action `closeDay` (app/fechar-o-dia/actions.ts) recalcula tudo server-side via `lib/day-totals.ts` — não mexer.
- Navegação por mês com setas ‹ › : padrão pronto em `app/extras/page.tsx` (funções `currentMonth`/`shiftMonth`/`monthRange`/`monthLabel` + links `?mes=YYYY-MM`, seta › desabilitada no mês corrente). Copiar o padrão.
- Atalhos do painel: componente `Atalho` em `app/painel/page.tsx` (~linha 144) — adicionar ali o link da tela nova.
- `brl()` de `lib/format.ts` pra valores; semáforos `ok`/`warn`/`danger`.

## Passo a passo

1. **`app/fechamentos/page.tsx`** (admin-only: `getCurrentProfile()`, se `role !== "admin"` → `redirect("/")`):
   - `<Shell>` + `<TopBar title="Fechamentos" subtitle="histórico dos dias" backHref="/painel" role={roleLabel(profile)} />`.
   - Query: `day_closures` do mês (`?mes=` como nos extras), `order work_date desc`. Capturar `error` → `<DataErrorCard />`.
   - Hero do mês: total de cartões somado, quebra de caixa acumulada (destaque `text-danger` se negativa), nº de dias fechados.
   - Lista: um card por dia — data (`formatDateBR` de lib/week.ts), quem fechou, cartões, motoboys, extras, e a **quebra com semáforo** (|diff| ≤ R$ 5 `ok`, ≤ R$ 30 `warn`, acima `danger`).
   - Dias sem registro não aparecem (sem linhas fantasma); estado vazio: "Nenhum dia fechado neste mês ainda."
2. **`app/fechamentos/loading.tsx`** com `PageSkeleton`.
3. **Atalho no painel**: em `app/painel/page.tsx`, adicionar `<Atalho href="/fechamentos" label="Fechamentos" hint="histórico" />` na grade existente.
4. **Selo na home**: no `TodayHero` (ou num componente pequeno logo abaixo dele), se existir `day_closures` com `work_date = todayISO()`, mostrar pílula "✓ dia fechado às HH:MM por <nome>" (usar `updated_at` convertido pra SP). Buscar com query leve própria (select `updated_at, closed_by_name` limit 1) dentro do mesmo Suspense do hero.
5. Nenhuma migration necessária. **Decisão a perguntar pro Diego durante a execução**: incluir os totais do Saipos no registro do fechamento (colunas novas `saipos_total`/`saipos_cash` preenchidas pela `closeDay` via `getSaiposSuggestion()`)? Se ele topar, é migration `alter table add column` + 3 linhas na action — pedir o "sim" pro SQL.

## Verificação

1. `npx tsc --noEmit` && `npx next build`.
2. Se `day_closures` ainda estiver vazia, inserir via REST (service_role) 2–3 linhas de teste com datas passadas, conferir a tela, e **apagar as linhas de teste** ao final.
3. Testar navegação de mês (mês sem dados → estado vazio) e o acesso negado como operator (redirect).
4. Pedir "sim" pro Diego e deployar; smoke em /fechamentos logado como admin.

## Fora de escopo

- Editar/apagar fechamentos pela UI (registro é auditável; correção = refechar o dia pelo wizard, que faz upsert).
- Gráficos de tendência (se o Diego quiser depois, reusar o padrão de chart de `motoboys/historico`).
- A tabela órfã `delivery_daily_history` — não é usada por esta feature; segue quieta.
