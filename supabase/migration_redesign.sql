-- =====================================================
-- TOCS - Redesign (telefone de funcionário + movimentações de caixa)
-- Rode no SQL Editor do Supabase.
-- =====================================================

-- 1. Telefone do funcionário (extras)
alter table public.employees
  add column if not exists phone text;

-- 2. Movimentações de caixa (sangrias, reforços, despesas avulsas, etc)
-- Registradas durante a sessão aberta. Entram na fórmula de fechamento:
--   esperado = abertura + entradas - saidas
--   diferença = contado - esperado
create table if not exists public.cash_movements (
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
