-- =====================================================
-- TOCS - Feature: Controle de Caixa (DLV + LTDA)
-- Rode esse SQL no SQL Editor do Supabase.
-- Compartilhado entre todos os usuários autenticados.
-- =====================================================

-- 1. Caixas físicos (seed: DLV e LTDA)
create table if not exists public.cash_drawers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.cash_drawers (name) values ('DLV'), ('LTDA')
on conflict (name) do nothing;

-- 2. Sessões diárias (uma por caixa por dia operacional)
-- Status:
--   'open'   = aberta, fechamento pendente
--   'closed' = fechada (com closing_amount preenchido)
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  drawer_id uuid not null references public.cash_drawers(id) on delete restrict,
  work_date date not null,

  opened_at timestamptz not null default now(),
  opened_by uuid references auth.users(id) on delete set null,
  opening_amount numeric(10, 2) not null,
  opening_breakdown jsonb,

  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  closing_amount numeric(10, 2),
  closing_breakdown jsonb,

  expected_amount numeric(10, 2),
  notes text,
  status text not null default 'open' check (status in ('open', 'closed')),

  created_at timestamptz not null default now()
);

-- Uma sessão aberta por vez por caixa
create unique index if not exists cash_sessions_one_open_per_drawer
  on public.cash_sessions (drawer_id) where status = 'open';

create index if not exists cash_sessions_drawer_date_idx
  on public.cash_sessions (drawer_id, work_date desc);

create index if not exists cash_sessions_work_date_idx
  on public.cash_sessions (work_date desc);

-- 3. RLS — compartilhado
alter table public.cash_drawers enable row level security;
alter table public.cash_sessions enable row level security;

drop policy if exists "cash_drawers_all_authenticated" on public.cash_drawers;
create policy "cash_drawers_all_authenticated"
  on public.cash_drawers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "cash_sessions_all_authenticated" on public.cash_sessions;
create policy "cash_sessions_all_authenticated"
  on public.cash_sessions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
