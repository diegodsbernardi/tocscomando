-- =====================================================
-- TOCS - Fechamento do dia + Caixa de sugestões
-- =====================================================

-- ---------- day_closures: registro real do "Fechar o dia" ----------
create table if not exists public.day_closures (
  id uuid primary key default gen_random_uuid(),
  work_date date not null unique,
  closed_by uuid not null,
  closed_by_name text,
  moto_total numeric(10, 2),
  extras_pagos numeric(10, 2),
  extras_pendentes numeric(10, 2),
  cash_total numeric(10, 2),
  cash_diff numeric(10, 2),
  card_total numeric(10, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.day_closures enable row level security;

drop policy if exists "day_closures_read" on public.day_closures;
create policy "day_closures_read"
  on public.day_closures for select
  using (auth.role() = 'authenticated');

drop policy if exists "day_closures_insert" on public.day_closures;
create policy "day_closures_insert"
  on public.day_closures for insert
  with check (auth.uid() = closed_by);

-- refechar o mesmo dia atualiza o registro (upsert)
drop policy if exists "day_closures_update" on public.day_closures;
create policy "day_closures_update"
  on public.day_closures for update
  using (auth.role() = 'authenticated');

-- ---------- suggestions: caixa de sugestões dos funcionários ----------
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid not null,
  author_name text,
  content text not null,
  status text not null default 'nova' -- 'nova' | 'implementada'
);

create index if not exists suggestions_created_idx
  on public.suggestions (created_at desc);

alter table public.suggestions enable row level security;

drop policy if exists "suggestions_read" on public.suggestions;
create policy "suggestions_read"
  on public.suggestions for select
  using (auth.role() = 'authenticated');

drop policy if exists "suggestions_insert" on public.suggestions;
create policy "suggestions_insert"
  on public.suggestions for insert
  with check (auth.uid() = author_id);

-- só admin muda status / apaga
drop policy if exists "suggestions_update_admin" on public.suggestions;
create policy "suggestions_update_admin"
  on public.suggestions for update
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

drop policy if exists "suggestions_delete_admin" on public.suggestions;
create policy "suggestions_delete_admin"
  on public.suggestions for delete
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );
