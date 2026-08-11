-- =====================================================
-- TOCS - classificar desconto por CANAL de venda
--
-- A primeira versão separava só "Voucher Parceiro Desconto" (iFood) do resto,
-- e jogava no balde "manual" os descontos do Cardápio Web — que são promoção
-- do delivery próprio, não alguém apertando desconto no balcão.
--
-- Agora guardamos o parceiro da venda e classificamos em 3 canais:
--   parceiro     → iFood e afins (cupom da plataforma)
--   cardapio_web → delivery próprio (promoção que O TOCS banca, mas é decisão
--                  de marketing, não desvio de caixa)
--   balcao       → sem parceiro: desconto batido no PDV. É o que vira alerta.
-- =====================================================

alter table public.saipos_discount_sales
  add column if not exists partner_name text,
  add column if not exists channel text;

create index if not exists saipos_discount_sales_channel_idx
  on public.saipos_discount_sales (channel, work_date desc);

-- O resumo diário passa a separar o desconto de balcão dos demais.
alter table public.saipos_daily_sales
  add column if not exists counter_discount_amount numeric(10, 2) not null default 0,
  add column if not exists web_discount_amount numeric(10, 2) not null default 0,
  add column if not exists partner_discount_amount numeric(10, 2) not null default 0;

comment on column public.saipos_daily_sales.manual_discount_amount is
  'Legado: tudo que não era voucher de parceiro. Use counter_discount_amount (balcão).';
comment on column public.saipos_daily_sales.counter_discount_amount is
  'Desconto em venda sem parceiro — batido no PDV. É o que o alerta observa.';
