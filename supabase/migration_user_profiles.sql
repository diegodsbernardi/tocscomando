-- =====================================================
-- TOCS - Papéis e escopagem por caixa
-- =====================================================

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'operator' check (role in ('admin', 'operator')),
  default_drawer_id uuid references public.cash_drawers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_drawer_idx
  on public.user_profiles (default_drawer_id);

-- Seed: Diego é admin
insert into public.user_profiles (user_id, display_name, role)
select id, 'Diego', 'admin'
from auth.users
where email = 'diegodsbernardi@gmail.com'
on conflict (user_id) do update set role = 'admin', display_name = excluded.display_name;

-- RLS
alter table public.user_profiles enable row level security;

-- Qualquer authenticated lê (UI mostra time)
drop policy if exists "user_profiles_read_all" on public.user_profiles;
create policy "user_profiles_read_all"
  on public.user_profiles for select
  using (auth.role() = 'authenticated');

-- Usuário cria o próprio perfil ao logar pela primeira vez (sempre como operator)
drop policy if exists "user_profiles_insert_self" on public.user_profiles;
create policy "user_profiles_insert_self"
  on public.user_profiles for insert
  with check (auth.uid() = user_id and role = 'operator');

-- Admin pode editar qualquer perfil
drop policy if exists "user_profiles_update_admin" on public.user_profiles;
create policy "user_profiles_update_admin"
  on public.user_profiles for update
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

-- Admin pode inserir perfil para outros (caso queira pre-cadastrar)
drop policy if exists "user_profiles_insert_admin" on public.user_profiles;
create policy "user_profiles_insert_admin"
  on public.user_profiles for insert
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

-- Função pra listar a equipe (com email, requer SECURITY DEFINER pra ler auth.users).
-- Só admins podem chamar — protege via check explícito.
create or replace function public.team_members()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  default_drawer_id uuid,
  default_drawer_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_profiles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
    select
      up.user_id,
      u.email::text,
      up.display_name,
      up.role,
      up.default_drawer_id,
      cd.name as default_drawer_name,
      up.created_at
    from public.user_profiles up
    join auth.users u on u.id = up.user_id
    left join public.cash_drawers cd on cd.id = up.default_drawer_id
    order by up.created_at;
end;
$$;

revoke all on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated;

-- =====================================================
-- App settings (chave/valor) — começa com meta diária
-- =====================================================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('revenue_goal_daily', '8000'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_read_all" on public.app_settings;
create policy "app_settings_read_all"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "app_settings_write_admin" on public.app_settings;
create policy "app_settings_write_admin"
  on public.app_settings for all
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );
