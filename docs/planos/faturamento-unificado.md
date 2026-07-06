# Plano: Faturamento unificado (Saipos como fonte + conferência de cupons)

> **Como usar**: abra uma sessão de Claude Code em `~/tocscomando` e mande: *"executa o plano docs/planos/faturamento-unificado.md"*.
> **Leia primeiro** `docs/planos/_convencoes.md` — regras do repo, SQL via Management API e aprovações obrigatórias do Diego.

## Problema

A home (`components/dashboard/TodayHero.tsx`) mostra "FATURAMENTO HOJE" somando os **cupons Safrapay fotografados** (`reports`) — que dependem de alguém fotografar e só cobrem cartão/pix. Enquanto isso, o **Saipos** (PDV) tem o faturamento real das 2 lojas, capturado a cada 30min pelo cron em `saipos_snapshots`. São duas fontes soltas que não conversam.

## Objetivo

1. O número grande da home passa a ser o **total real do Saipos** (soma das 2 lojas) quando houver snapshot do dia.
2. Os cupons fotografados viram **linha de conferência**: "cartões conferidos R$ X" vs "cartões no Saipos R$ Y", com semáforo.
3. Sem snapshot do dia (fora da janela 19h–23h30 ou cron falhou): fallback pro comportamento atual (cupons), com indicação discreta da fonte.

## O que já existe (reusar, não recriar)

- `lib/saipos.ts:getSaiposSuggestion()` — retorna `{ captured_at, total_sales, cash_sales, card_sales, pix_sales, stores }` já somando o snapshot mais recente de cada loja do dia (fuso SP). É `cache()`d.
- `TodayHero` já busca os `reports` do dia da equipe toda (`.gte("created_at", startOfDayISO())`, sem filtro de usuário).
- Meta do dia: `getDailyRevenueGoal()` de `lib/settings.ts` (default R$ 8.000).
- Tokens de semáforo `ok`/`warn`/`danger` (+ `-bg`) no tailwind.

## Passo a passo

1. **`components/dashboard/TodayHero.tsx`**:
   - Buscar em paralelo (`Promise.all`): `getAuthUser()`, `getDailyRevenueGoal()`, `getSaiposSuggestion()` e a query de `reports` atual.
   - Se `saipos !== null`: número grande = `saipos.total_sales`; badge "ao vivo" vira `Saipos · HH:MM` (formatar `captured_at` com `toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })`); barra de meta usa o total Saipos.
   - Breakdown (3 colunas Crédito/Débito/Pix) permanece dos cupons, mas adicionar uma linha de conferência abaixo: cartões fotografados (`credito+debito+pix` dos reports) vs `saipos.card_sales + saipos.pix_sales`. Diferença ≤ R$ 5 → texto `text-ok` "✓ cupons conferem"; diferença maior → `text-warn` "⚠ falta fotografar R$ N em cupons" (ou "cupons acima do Saipos" se negativo).
   - Se `saipos === null`: layout atual intacto + `<small>` discreto "fonte: cupons fotografados (Saipos ativo 19h–23h30)".
2. **`components/dashboard/QuickStats.tsx`**: sem mudança (cupons/ticket médio continuam fazendo sentido como estão).
3. **`/painel`** (`lib/painel-stats.ts` + `app/painel/page.tsx`) — segunda etapa opcional, só se o Diego pedir: série de faturamento por dia poderia vir de `saipos_snapshots` (último snapshot de cada loja por `work_date`) em vez de `reports`. NÃO fazer sem confirmar; anotar como pendência ao final.
4. Nenhuma migration necessária.

## Verificação

1. `npx tsc --noEmit` && `npx next build`.
2. Dados reais: conferir com REST que existe snapshot de hoje (`saipos_snapshots?work_date=eq.<hoje SP>`); comparar o valor renderizado (lógica) com a soma manual dos 2 últimos snapshots por loja.
3. Testar o fallback: a lógica com `saipos === null` (ex.: rodar de manhã, quando ainda não há snapshot do dia — ou simular).
4. Pedir "sim" pro Diego e deployar; conferir a home no ar durante o serviço (após 19h30 tem snapshot fresco a cada 30min).

## Fora de escopo

- Mudar a fonte do /painel (etapa opcional acima, só com confirmação).
- Alertar quebra por forma de pagamento individual (crédito vs crédito) — Saipos e Safrapay categorizam diferente ("Pago Online" etc.); ficar no agregado cartões+pix.
- Tocar no fluxo de captura de cupom.
