# Convenções obrigatórias do repo tocscomando

> Este arquivo é referenciado pelos planos em `docs/planos/`. Leia ANTES de codar.

## Projeto

App **TOCS Comando** — operação do restaurante TOCS Burger (Chapecó/SC). Next.js 14 App Router + TypeScript + Tailwind + Supabase (projeto `khwjhfkolicttuxbugiz`). Deploy: Vercel, produção em **tocs.vercel.app** (`npx vercel --prod` na raiz do repo). Mobile-first (a equipe usa no celular durante o serviço). Idioma da UI e dos commits: **português BR**.

## Regras inegociáveis

1. **Datas em código server**: SEMPRE via `lib/dates.ts` (`todayISO()`, `startOfDayISO()`, `currentMonth()`, `toSPDate()`) — o server roda em UTC e o restaurante é America/Sao_Paulo; `new Date().getFullYear()` etc. causou bug crítico já corrigido. Client components (`"use client"`) podem usar hora local (o celular já está em BRT).
2. **Telas autenticadas**: envolver em `<Shell>` (components/ui/Shell.tsx) com `<TopBar title subtitle backHref role>` — nunca `<main>` próprio. Verificar auth com `getAuthUser()` de `lib/profile.ts` (cached) e `redirect("/login")`.
3. **Toda rota nova** ganha `loading.tsx` usando `PageSkeleton` de `components/ui/Skeleton.tsx`.
4. **Confirmação/erro em client components**: `confirmDialog("...")` / `notifyDialog("...")` de `components/ui/ConfirmDialog.tsx` (host global já montado no layout). NUNCA `window.confirm`/`alert`.
5. **Falha de query em página server**: capturar `error` do Supabase e renderizar `<DataErrorCard />` (components/ui/DataErrorCard.tsx) — não deixar cair no estado vazio.
6. **Design system** (tailwind.config.ts): cores `cyan`/`cyan-deep`/`navy`/`brandyellow`/`muted`/`line`/`appbg`, semáforos `ok`/`warn`/`danger` (+ variante `-bg`). Cards: `rounded-card bg-white shadow-card`. Heros: `rounded-hero bg-cyan-hero shadow-glow`. Números grandes: `font-display font-extrabold tabular-nums`. Alvos de toque ≥ 40px.
7. **Totais do dia** (motoboys/extras/caixa/cartões): fonte única `lib/day-totals.ts:getDayData(scopedDrawerId)`. Não duplicar as fórmulas.
8. **Papéis**: `lib/profile.ts` — `getCurrentProfile()`, `roleLabel()`, `visibleDrawerFilter()` (operator escopado por caixa), `canSeeMotoboys()` (Salão não vê motoboys). Telas admin-only: checar `profile?.role === "admin"` e `redirect("/")`.
9. **Server actions**: retornar `{ ok, error }`, sempre `revalidatePath` nas rotas afetadas. Padrão em `app/extras/actions.ts`.

## SQL / migrations (sem dashboard)

Token de acesso em `~/.supabase/access-token` (NUNCA imprimir o conteúdo). Rodar SQL:

```bash
TOKEN=$(tr -d '\n' < ~/.supabase/access-token)
curl -s -X POST "https://api.supabase.com/v1/projects/khwjhfkolicttuxbugiz/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "User-Agent: supabase-cli/2.0" \
  --data '{"query":"<SQL aqui>"}'
```
- DDL com sucesso retorna `[]`. Depois de criar/alterar tabela: `NOTIFY pgrst, 'reload schema';` (senão o REST dá 404).
- Salvar toda migration também como arquivo em `supabase/migration_<nome>.sql` (versionado).
- Consultas de verificação de dados: REST direto com a `SUPABASE_SERVICE_ROLE_KEY` do `.env.local` (extrair com `grep 'SUPABASE_SERVICE_ROLE_KEY' .env.local | grep -oP 'eyJ[A-Za-z0-9._-]+'` — o arquivo tem formato do Vercel, não dá pra fazer `source`).

## Aprovações do Diego (obrigatórias, pedir no chat e esperar o "sim")

- **Deploy em produção** (`npx vercel --prod`) — o classificador bloqueia sem consentimento explícito na conversa.
- **Qualquer mudança de RLS/permissão** no banco.
- Preview deploy do Vercel NÃO funciona (env vars só existem em produção) — o fluxo é: `npx tsc --noEmit` + `npx next build` local → pedir o "sim" → deploy prod.

## Contexto de negócio útil

- 2 caixas físicos: `cash_drawers.name = 'DLV'` → "Delivery", `'LTDA'` → "Salão".
- 2 lojas no Saipos (PDV): `49895` (CNPJ antigo, ativo) e `49897` (CNPJ novo, em implantação — já vende). Cron do GitHub Actions (`saipos-scrape.yml`) captura vendas por forma de pagamento a cada 30min das 19h às 23h30 BRT em `saipos_snapshots` (um snapshot por loja, `drawer_name` = id da loja). Leitura: `lib/saipos.ts:getSaiposSuggestion()` soma o snapshot mais recente de cada loja do dia.
- Cupons Safrapay fotografados ficam em `reports` (leitura liberada pra equipe toda; insert/delete do dono, delete também admin).
- Fechamento do dia: wizard `/fechar-o-dia` (5 passos) → botão Concluir grava `day_closures` (upsert por `work_date`, totais recalculados no server).
