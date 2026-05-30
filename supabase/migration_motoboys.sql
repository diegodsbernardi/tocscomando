-- =====================================================
-- TOCS - Feature: Motoboys (terceirizados)
-- Pagamento semanal · Mínimo R$100/dia · ~55 bairros
-- =====================================================

-- 1. Motoboys (cadastro)
create table if not exists public.motoboys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists motoboys_name_lower_idx on public.motoboys (lower(name));

-- 2. Bairros e taxas
create table if not exists public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fee numeric(6, 2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists delivery_areas_name_lower_idx on public.delivery_areas (lower(name));

-- 3. Turno do motoboy (1 por motoboy por dia)
create table if not exists public.motoboy_shifts (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references public.motoboys(id) on delete restrict,
  work_date date not null,
  arrival_time time,
  notes text,
  paid boolean not null default false,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists motoboy_shifts_motoboy_date_idx
  on public.motoboy_shifts (motoboy_id, work_date);
create index if not exists motoboy_shifts_work_date_idx
  on public.motoboy_shifts (work_date desc);

-- 4. Corridas por bairro dentro do turno
create table if not exists public.motoboy_shift_rides (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.motoboy_shifts(id) on delete cascade,
  area_id uuid not null references public.delivery_areas(id) on delete restrict,
  rides_count integer not null default 0 check (rides_count >= 0),
  fee_at_time numeric(6, 2) not null,
  created_at timestamptz not null default now()
);
create unique index if not exists motoboy_shift_rides_shift_area_idx
  on public.motoboy_shift_rides (shift_id, area_id);

-- 5. Histórico agregado (importado da planilha)
-- Total de corridas por dia, sem motoboy específico.
-- Usado apenas pros gráficos de tendência histórica.
create table if not exists public.delivery_daily_history (
  work_date date primary key,
  total_rides integer not null check (total_rides >= 0),
  notes text,
  created_at timestamptz not null default now()
);

-- 6. RLS compartilhado
alter table public.motoboys enable row level security;
alter table public.delivery_areas enable row level security;
alter table public.motoboy_shifts enable row level security;
alter table public.motoboy_shift_rides enable row level security;
alter table public.delivery_daily_history enable row level security;

drop policy if exists "motoboys_all_authenticated" on public.motoboys;
create policy "motoboys_all_authenticated" on public.motoboys for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "delivery_areas_all_authenticated" on public.delivery_areas;
create policy "delivery_areas_all_authenticated" on public.delivery_areas for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "motoboy_shifts_all_authenticated" on public.motoboy_shifts;
create policy "motoboy_shifts_all_authenticated" on public.motoboy_shifts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "motoboy_shift_rides_all_authenticated" on public.motoboy_shift_rides;
create policy "motoboy_shift_rides_all_authenticated" on public.motoboy_shift_rides for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "delivery_daily_history_all_authenticated" on public.delivery_daily_history;
create policy "delivery_daily_history_all_authenticated" on public.delivery_daily_history for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 7. Seed dos bairros e taxas (da planilha original)
insert into public.delivery_areas (name, fee) values
  ('Passo dos Fortes', 8),
  ('Pres. Médice', 8),
  ('Centro', 9),
  ('Jardim Itália', 9),
  ('Líder', 10),
  ('Maria Goretti', 10),
  ('Pinheirinho', 12),
  ('Bela Vista', 12),
  ('Cristo Rei', 12),
  ('Jardim América', 12),
  ('Parque das Palmeiras', 12),
  ('Saic', 12),
  ('Santa Luzia', 12),
  ('Santa Maria', 12),
  ('Santo Antônio', 12),
  ('São Cristovão', 12),
  ('Palmital', 12),
  ('Paraíso', 12),
  ('Alvorada', 14),
  ('Esplanada', 14),
  ('São Lucas', 14),
  ('Boa Vista', 15),
  ('Bom Pastor', 15),
  ('Eldorado', 15),
  ('Engenho Braun', 15),
  ('Jardim Esplanada', 15),
  ('Jardim Europa', 15),
  ('Jardins', 15),
  ('Jardins do Vale', 15),
  ('Quedas do Palmital', 15),
  ('Santa Paulina', 15),
  ('São Pedro', 15),
  ('Universitário', 15),
  ('Vila Real', 15),
  ('Seminário', 16),
  ('Vila Mantelli', 16),
  ('Belvedere', 20),
  ('Bom Retiro', 20),
  ('Campestre', 20),
  ('Desbravador', 20),
  ('Dom Gerônimo', 20),
  ('Efapi', 20),
  ('Expoente', 20),
  ('Lajeado', 20),
  ('Monte Belo', 20),
  ('Monte Castelo', 20),
  ('Reserva dos Pinhais', 20),
  ('Rodeio Chato', 20),
  ('Santos Dumond', 20),
  ('Distrito Industrial', 25),
  ('Araras', 30),
  ('Di Fiori', 30),
  ('Fronteira Sul', 30),
  ('São Roque', 30),
  ('Trevo', 30)
on conflict (lower(name)) do nothing;

-- 8. Seed dos motoboys vistos na planilha (telefones ficam pra preencher)
insert into public.motoboys (name) values
  ('Ademir'),
  ('Bruno'),
  ('Crislaine Aduatt'),
  ('Elizeu Azevedo'),
  ('Elodir Roque'),
  ('Gilberto'),
  ('Henrique Alonço'),
  ('Higo Oliveira'),
  ('Joao Mohr'),
  ('Lobato')
on conflict (lower(name)) do nothing;
