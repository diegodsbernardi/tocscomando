-- =====================================================
-- FIX: public.cash_movements está com schema ANTIGO em prod
-- (colunas type/description/unit_id/related_*), porque o
-- `create table if not exists` da migration_redesign.sql no-opou —
-- a tabela já existia de um scaffolding anterior.
-- Resultado: o CashMovementForm (direction/category/note) falha no insert.
--
-- A tabela está VAZIA em prod (verificado em 2026-07-06), então o fix
-- seguro é dropar e recriar no schema esperado pelo app.
-- NÃO RODAR sem o "sim" do Diego. Depois: NOTIFY pgrst, 'reload schema';
-- =====================================================

drop table if exists public.cash_movements;

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  category text not null,
  amount numeric(10, 2) not null check (amount > 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_session_idx
  on public.cash_movements (session_id);

alter table public.cash_movements enable row level security;

drop policy if exists "cash_movements_all_authenticated" on public.cash_movements;
create policy "cash_movements_all_authenticated"
  on public.cash_movements for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
