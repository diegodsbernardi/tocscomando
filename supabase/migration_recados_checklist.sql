-- =====================================================
-- TOCS - Recados de turno + Checklist de abertura/fechamento
-- =====================================================

-- ---------- shift_notes: mural de recados entre turnos ----------
create table if not exists public.shift_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid not null,
  author_name text,
  content text not null,
  resolved boolean not null default false,
  resolved_by uuid,
  resolved_by_name text,
  resolved_at timestamptz
);

create index if not exists shift_notes_open_idx
  on public.shift_notes (resolved, created_at desc);

alter table public.shift_notes enable row level security;

drop policy if exists "shift_notes_read" on public.shift_notes;
create policy "shift_notes_read"
  on public.shift_notes for select
  using (auth.role() = 'authenticated');

drop policy if exists "shift_notes_insert" on public.shift_notes;
create policy "shift_notes_insert"
  on public.shift_notes for insert
  with check (auth.uid() = author_id);

-- resolver: qualquer autenticado (é rotina de equipe)
drop policy if exists "shift_notes_update" on public.shift_notes;
create policy "shift_notes_update"
  on public.shift_notes for update
  using (auth.role() = 'authenticated');

drop policy if exists "shift_notes_delete_admin" on public.shift_notes;
create policy "shift_notes_delete_admin"
  on public.shift_notes for delete
  using (
    exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

-- ---------- day_checklist: checks do turno por dia ----------
create table if not exists public.day_checklist (
  work_date date not null,
  item_key text not null,
  done_by uuid not null,
  done_by_name text,
  done_at timestamptz not null default now(),
  primary key (work_date, item_key)
);

alter table public.day_checklist enable row level security;

drop policy if exists "day_checklist_read" on public.day_checklist;
create policy "day_checklist_read"
  on public.day_checklist for select
  using (auth.role() = 'authenticated');

drop policy if exists "day_checklist_insert" on public.day_checklist;
create policy "day_checklist_insert"
  on public.day_checklist for insert
  with check (auth.uid() = done_by);

-- desmarcar (delete do check) por qualquer autenticado — correção de engano
drop policy if exists "day_checklist_delete" on public.day_checklist;
create policy "day_checklist_delete"
  on public.day_checklist for delete
  using (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
