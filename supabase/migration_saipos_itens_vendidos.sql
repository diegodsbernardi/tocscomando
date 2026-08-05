-- =====================================================
-- TOCS - SAIPOS itens vendidos (relatório itemsSold)
--
-- Fonte: GET api.saipos.com/v1/stores/{id}/itemsSold?filter={...}
-- Uma linha por produto vendido por dia por loja, mais uma tabela para os
-- complementos (choices) — "TROCAR POR MUSSARELA", "SEM MAIONESE", etc.
--
-- O comando roda várias vezes ao dia; por isso as unique keys: reexecutar
-- atualiza a linha em vez de duplicar.
-- =====================================================

create table if not exists public.saipos_items_sold (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  store_id text not null,          -- id da loja no Saipos (49895 | 49897)
  item_name text not null,         -- desc_item
  item_code text,                  -- identifier_number (código do PDV, costuma ser null)
  qty numeric(10, 3) not null default 0,      -- total_qtt
  total_value numeric(10, 2) not null default 0, -- total_value
  percentual numeric(7, 3),        -- participação no faturamento do período
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (work_date, store_id, item_name)
);

create index if not exists saipos_items_sold_date_idx
  on public.saipos_items_sold (work_date desc, store_id);

create index if not exists saipos_items_sold_item_idx
  on public.saipos_items_sold (item_name, work_date desc);

create table if not exists public.saipos_choices_sold (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  store_id text not null,
  choice_name text not null,       -- desc_store_choice — o grupo ("Deseja Alterar Algo?")
  choice_item_name text not null,  -- desc_store_choice_item — a opção escolhida
  qty numeric(10, 3) not null default 0,
  total_value numeric(10, 2) not null default 0,
  percentual numeric(7, 3),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (work_date, store_id, choice_name, choice_item_name)
);

create index if not exists saipos_choices_sold_date_idx
  on public.saipos_choices_sold (work_date desc, store_id);

-- RLS: mesma regra dos snapshots — equipe lê, só o service_role (robô) escreve.
alter table public.saipos_items_sold enable row level security;
alter table public.saipos_choices_sold enable row level security;

drop policy if exists "saipos_items_sold_read_all" on public.saipos_items_sold;
create policy "saipos_items_sold_read_all"
  on public.saipos_items_sold for select
  using (auth.role() = 'authenticated');

drop policy if exists "saipos_choices_sold_read_all" on public.saipos_choices_sold;
create policy "saipos_choices_sold_read_all"
  on public.saipos_choices_sold for select
  using (auth.role() = 'authenticated');
