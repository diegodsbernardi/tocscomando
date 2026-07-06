# Backlog: Controle de caixa e gestão — plano de execução sequencial

> **Como usar**: abra uma sessão de Claude Code em `~/tocscomando` e mande:
> *"executa o próximo item do docs/planos/backlog-caixa-gestao.md"*.
>
> **PROTOCOLO (obrigatório):**
> 1. Leia `docs/planos/_convencoes.md` antes de codar (regras do repo, SQL via Management API, aprovações do Diego).
> 2. Execute **UM item por vez** — o primeiro desmarcado da lista abaixo. Termine, verifique, commite, e PARE. Não emende o próximo sem o Diego pedir.
> 3. Ao concluir um item: marque o checkbox aqui neste arquivo (`[x]` + data), commite junto com o código.
> 4. Deploy em produção só com "sim" explícito do Diego no chat (build local antes).
> 5. Ideia nova no meio do caminho = anotar na seção "Ideias anotadas" no fim deste arquivo, não executar (Diego tem TDAH e o pacto é foco).

## Ordem de execução

- [x] **1. Aviso de dia não fechado** (pequeno) — 2026-07-06
- [x] **2. Alerta de quebra de caixa recorrente** (pequeno) — 2026-07-06
- [x] **3. Relatório semanal pronto pro WhatsApp** (médio — maior impacto pro Diego) — 2026-07-06
- [x] **4. DRE simplificado do mês no painel** (médio) — 2026-07-06
- [x] **5. Comparativo de vendas por dia da semana** (médio) — 2026-07-06
- [x] **6. Contagem por cédula também na abertura** (pequeno) — 2026-07-06
- [x] **7. Destino de sangria** (pequeno) — 2026-07-06 · ⚠️ requer rodar `supabase/migration_cash_movements_fix.sql` em prod (tabela `cash_movements` está com schema antigo — form de movimentações já estava quebrado antes deste item)
- [x] **8. Previsão de vínculo de extras na semana** (pequeno) — 2026-07-06

---

## Item 1 — Aviso de dia não fechado

**Problema**: se ninguém apertar "Concluir" no wizard, o dia fica sem registro em `day_closures` e ninguém percebe.

**Fazer**:
- Componente server `components/dashboard/DayNotClosedBanner.tsx`: consulta se existe `day_closures` com `work_date` = ontem (calcular ontem em SP: derivar de `todayISO()` de `lib/dates.ts`, cuidado pra não usar `new Date()` local). Só considerar "não fechado" se ontem teve movimento (existe `cash_sessions` OU `motoboy_shifts` com `work_date` de ontem — senão dia fechado/folga geraria alarme falso).
- Renderizar na home (`app/page.tsx`, acima dos cards): card `bg-warn-bg text-warn` "⚠ Ontem (sex, 05/jul) ficou sem fechar o dia" com link pro `/fechar-o-dia` (obs: o wizard só opera o dia corrente — o link é pra não esquecer HOJE; deixar claro no texto).
- Envolver em `<Suspense>` com fallback null (não atrasar a home).

**Verificar**: typecheck/build; simular com dados reais (há dias passados com sessões e sem day_closures — o banner deve aparecer). Depois do deploy aprovado, conferir na home.

---

## Item 2 — Alerta de quebra de caixa recorrente

**Problema**: a quebra é calculada por sessão mas ninguém vigia tendência (R$ 20 sumindo toda noite = R$ 600/mês).

**Fazer**:
- `lib/cash-alerts.ts`: função que pega as sessões fechadas dos últimos 14 dias (`cash_sessions` com `closing_amount`/`expected_amount`) e retorna, por caixa: quebra acumulada, nº de dias com quebra além de R$ 5, e flag `recorrente` (3+ dias no período) / `grave` (acumulado < −R$ 100).
- Exibir: card no `/painel` (seção custos) com semáforo `warn`/`danger` e detalhe por caixa ("DLV: −R$ 84 em 5 dias nos últimos 14"). Admin-only por natureza (painel já é).
- Limites como constantes exportadas no topo do lib (fácil de ajustar).

**Verificar**: recomputar na mão via REST com os dados reais e comparar com o card.

---

## Item 3 — Relatório semanal pronto pro WhatsApp

**Problema**: toda segunda o Diego monta manualmente o resumo da semana (avaliações iFood fora do escopo; aqui é a parte financeira/operacional).

**Fazer**:
- `lib/weekly-report.ts`: monta os dados da semana operacional anterior (ter→seg, usar `lib/week.ts`): faturamento por dia (fonte `saipos_snapshots`, último snapshot por loja/dia, somado), total motoboys (fórmula com piso de `lib/day-totals.ts`/`lib/motoboys.ts`), extras pagos/pendentes, quebra de caixa acumulada, dias sem fechamento.
- Rota `/relatorio-semanal` (admin-only, atalho no /painel): mostra o resumo formatado E um botão **"Copiar pro WhatsApp"** (client component com `navigator.clipboard.writeText`) que copia versão texto com `*negrito*` do WhatsApp, emojis moderados, uma linha por dia.
- `?semana=YYYY-MM-DD` (início da semana) com setas ‹ › pra navegar semanas, padrão das setas de mês dos extras.
- NÃO tentar enviar WhatsApp automaticamente (sem API oficial) — o botão de copiar resolve; anotar em "Ideias anotadas" a hipótese de envio automático por e-mail/Telegram se o Diego pedir.

**Verificar**: comparar os números da semana passada com as fontes (snapshots, turnos, extras) via REST; testar o copiar no celular.

---

## Item 4 — DRE simplificado do mês no painel

**Problema**: o painel soma custos (motos, extras, quebra) mas não cruza com o faturamento real → não mostra margem.

**Fazer**:
- Estender `lib/painel-stats.ts`: faturamento do mês vindo de `saipos_snapshots` (último snapshot por loja por `work_date`, somado no mês corrente — fuso SP). Manter o de cupons como linha separada ("cartões fotografados") pra conferência.
- Seção nova no `/painel`: Receita (Saipos) − Custos rastreados (motos + extras + quebra) = **Sobra operacional** + % sobre receita. Deixar claro no texto que CMV/insumos/aluguel NÃO estão aqui (isso é papel do Gastão) — é margem operacional parcial.
- Card com `font-display` grande, semáforo pela % (definir limites com o Diego na execução).

**Verificar**: recomputar mês corrente na mão via REST; typecheck/build.

---

## Item 5 — Comparativo de vendas por dia da semana

**Problema**: dimensionar equipe/extras sem saber quanto cada dia da semana costuma vender.

**Fazer**:
- No `/painel` (ou aba nova `?tab=semana`): média de faturamento por dia da semana nas últimas 8 semanas, fonte `saipos_snapshots` (último snapshot por loja/dia). Barra horizontal por dia (ter..dom; seg costuma ser folga — confirmar com Diego), destaque no maior e menor.
- Usar `toSPDate`/`todayISO` de `lib/dates.ts` pra bucketing; dias sem snapshot ficam de fora da média (não contar como zero).
- Consultar a skill de dataviz antes de desenhar o chart (ver CLAUDE.md global); reusar o estilo do chart existente em `motoboys/historico`.

**Verificar**: conferir 2 médias na mão contra os snapshots.

---

## Item 6 — Contagem por cédula na abertura

**Problema**: o `CashCounter` (contagem guiada 5×R$50, 12×R$20...) existe só no fechamento; a abertura é um campo livre e o detalhamento não fica guardado.

**Fazer**:
- Reusar `components/CashCounter.tsx` em `app/caixa/abrir/page.tsx` (hoje input simples). A coluna `opening_breakdown` **já existe** em `cash_sessions` (ver `openSession` em app/caixa/actions.ts) — só passar o breakdown do counter pro insert.
- Exibir o breakdown salvo (abertura e fechamento) na tela da sessão/histórico como detalhe expansível (`<details>` estilizado ou toggle client).

**Verificar**: abrir sessão de teste com breakdown, conferir JSON gravado via REST, apagar a sessão de teste.

---

## Item 7 — Destino de sangria

**Problema**: sangria registrada não diz pra onde foi (cofre? banco? pagamento?) — não dá pra conferir depois.

**Fazer**:
- `cash_movements` já tem `category` e `note`. Adicionar no `CashMovementForm` um select de destino quando `direction=out` e categoria sangria/retirada: Cofre / Banco / Pagamento / Outro (gravar no início do `note` como prefixo `[destino]` — **sem migration**; se o Diego preferir coluna própria, aí é `alter table` + "sim" pro SQL).
- No `/painel` (ou item 2), somar sangrias por destino no mês.

**Verificar**: registrar movimentação de teste, conferir, apagar.

---

## Item 8 — Previsão de vínculo de extras

**Problema**: o alerta de vínculo (3+ vindas/semana = vermelho) é reativo; o Diego quer ver ANTES de chamar o extra de novo.

**Fazer**:
- Em `/extras/novo` (ExtraPicker): ao selecionar a pessoa, mostrar inline quantas vezes ela já veio NESTA semana (dados de `lib/vinculo.ts` — `isoWeekRange` + count) com o semáforo; se já está em 2, aviso "se vier hoje, entra no limite de vínculo".
- Reusar `VINCULO_LIMIT` e `levelForCount` de `lib/vinculo.ts`. Contagem via query no server e passada pro picker, ou action leve chamada no onSelect.

**Verificar**: selecionar funcionário com vindas na semana e conferir o aviso contra `/extras/perfil/<id>`.

---

## Ideias anotadas (não executar sem o Diego pedir)

- Envio automático do relatório semanal (e-mail/Telegram) — hoje é copiar/colar.
- Painel de faturamento por dia usando snapshots no lugar de cupons (etapa opcional do plano faturamento-unificado).
- Conferência de sangria × extrato bancário.
