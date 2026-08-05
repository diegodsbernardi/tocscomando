-- =====================================================
-- TOCS - SAIPOS descontos e fechamento por dia/loja
--
-- Fonte: relatório "Vendas por período" (venda a venda), capturado pela tela.
-- Duas tabelas:
--   saipos_daily_sales    → um resumo por dia/loja (itens, desconto, entrega...)
--   saipos_discount_sales → as vendas com desconto, uma a uma, pra auditoria
--
-- Distinção que importa: desconto de VOUCHER de parceiro (iFood etc.) é
-- promoção do marketplace; desconto MANUAL é alguém apertando o botão no PDV.
-- Só o segundo vira alerta.
-- =====================================================

create table if not exists public.saipos_daily_sales (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  store_id text not null,
  sales_count integer not null default 0,        -- vendas não canceladas
  items_amount numeric(10, 2) not null default 0,     -- valor de menu
  discount_amount numeric(10, 2) not null default 0,
  manual_discount_amount numeric(10, 2) not null default 0, -- sem voucher de parceiro
  increase_amount numeric(10, 2) not null default 0,
  delivery_fee numeric(10, 2) not null default 0,
  service_charge numeric(10, 2) not null default 0,
  net_amount numeric(10, 2) not null default 0,  -- o que o Saipos chama de total da venda
  canceled_count integer not null default 0,
  canceled_amount numeric(10, 2) not null default 0,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (work_date, store_id)
);

create index if not exists saipos_daily_sales_date_idx
  on public.saipos_daily_sales (work_date desc, store_id);

create table if not exists public.saipos_discount_sales (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  store_id text not null,
  id_sale bigint not null,
  sale_number text,
  sold_at timestamptz,
  shift text,                       -- desc_store_shift ("Noite")
  total_amount numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  discount_reason text,
  payment_types text,               -- "Dinheiro", "Pago Online, Voucher Parceiro Desconto"...
  is_partner_voucher boolean not null default false,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (work_date, store_id, id_sale)
);

create index if not exists saipos_discount_sales_date_idx
  on public.saipos_discount_sales (work_date desc, store_id);

-- RLS: equipe lê, só o service_role (robô) escreve.
alter table public.saipos_daily_sales enable row level security;
alter table public.saipos_discount_sales enable row level security;

drop policy if exists "saipos_daily_sales_read_all" on public.saipos_daily_sales;
create policy "saipos_daily_sales_read_all"
  on public.saipos_daily_sales for select
  using (auth.role() = 'authenticated');

drop policy if exists "saipos_discount_sales_read_all" on public.saipos_discount_sales;
create policy "saipos_discount_sales_read_all"
  on public.saipos_discount_sales for select
  using (auth.role() = 'authenticated');
