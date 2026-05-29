-- =====================================================
-- TOCS - Feature: Pagamento de Extras
-- Rode esse SQL no SQL Editor do Supabase.
-- Compartilhado entre todos os usuários autenticados.
-- =====================================================

-- 1. Cadastro de funcionários extras
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  centro_custo text not null check (centro_custo in ('atendimento', 'cozinha')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists employees_name_lower_idx
  on public.employees (lower(name));

-- 2. Pagamentos de extras (uma linha por funcionário-dia)
create table if not exists public.extra_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  work_date date not null,
  amount numeric(10, 2) not null,
  paid boolean not null default false,
  paid_amount numeric(10, 2),
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists extra_payments_work_date_idx
  on public.extra_payments (work_date desc);

create index if not exists extra_payments_employee_idx
  on public.extra_payments (employee_id);

-- 3. RLS — compartilhado: qualquer usuário autenticado lê/escreve
alter table public.employees enable row level security;
alter table public.extra_payments enable row level security;

drop policy if exists "employees_all_authenticated" on public.employees;
create policy "employees_all_authenticated"
  on public.employees for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "extra_payments_all_authenticated" on public.extra_payments;
create policy "extra_payments_all_authenticated"
  on public.extra_payments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4. Seed do cadastro de funcionários (da planilha original)
insert into public.employees (name, centro_custo) values
  ('Alejandro',        'cozinha'),
  ('Alex Ebisu',       'atendimento'),
  ('Alisson',          'atendimento'),
  ('Ana Paula',        'atendimento'),
  ('Aneli',            'cozinha'),
  ('Angel',            'cozinha'),
  ('Armando dono',     'cozinha'),
  ('Belquis',          'cozinha'),
  ('Claudio',          'atendimento'),
  ('Daryane Candido',  'atendimento'),
  ('Denise',           'cozinha'),
  ('Eduardo Jose',     'atendimento'),
  ('Elô',              'atendimento'),
  ('Eloir',            'atendimento'),
  ('Guilherme',        'atendimento'),
  ('Hecmary',          'cozinha'),
  ('Henrique',         'cozinha'),
  ('Himbert',          'cozinha'),
  ('Indianara',        'cozinha'),
  ('Ivony',            'cozinha'),
  ('Jesus',            'cozinha'),
  ('Joao Bazilista',   'atendimento'),
  ('John',             'cozinha'),
  ('Jose',             'cozinha'),
  ('Josimary',         'cozinha'),
  ('Josué',            'cozinha'),
  ('Magdelein',        'cozinha'),
  ('Maria Henicka',    'atendimento'),
  ('Maria J',          'cozinha'),
  ('Mateus Conte',     'atendimento'),
  ('Raiane Cardoso',   'atendimento'),
  ('Renata',           'atendimento'),
  ('Roberta',          'cozinha'),
  ('Rosimary',         'cozinha'),
  ('Sara',             'atendimento'),
  ('Sara Los',         'cozinha'),
  ('Sostenes Herberth','cozinha'),
  ('Thierry',          'atendimento'),
  ('Vitor',            'cozinha'),
  ('Welington Mateus', 'cozinha'),
  ('Wilmer',           'atendimento'),
  ('Yelique',          'cozinha')
on conflict (lower(name)) do nothing;
