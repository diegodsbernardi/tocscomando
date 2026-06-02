-- =====================================================
-- TOCS - SAIPOS snapshots (raspagem das vendas)
-- =====================================================

create table if not exists public.saipos_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  work_date date not null,
  drawer_name text, -- 'DLV' | 'LTDA' | null (consolidado)
  total_sales numeric(10, 2),
  cash_sales numeric(10, 2),
  card_sales numeric(10, 2),
  pix_sales numeric(10, 2),
  source text not null default 'scrape', -- 'scrape' | 'manual'
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saipos_snapshots_work_date_idx
  on public.saipos_snapshots (work_date desc, captured_at desc);

create index if not exists saipos_snapshots_drawer_idx
  on public.saipos_snapshots (drawer_name, work_date desc);

alter table public.saipos_snapshots enable row level security;

drop policy if exists "saipos_snapshots_read_all" on public.saipos_snapshots;
create policy "saipos_snapshots_read_all"
  on public.saipos_snapshots for select
  using (auth.role() = 'authenticated');

-- INSERT bloqueado para usuário regular — só service_role (no scraper) escreve
drop policy if exists "saipos_snapshots_admin_insert" on public.saipos_snapshots;
create policy "saipos_snapshots_admin_insert"
  on public.saipos_snapshots for insert
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );
