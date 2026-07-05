-- =====================================================
-- TOCS - Cupons visíveis pra equipe toda (leitura)
-- Antes: cada usuário só via os próprios cupons → totais do dia
-- fragmentados por operador. Insert/delete continuam restritos ao dono.
-- =====================================================

drop policy if exists "reports_select_own" on public.reports;
drop policy if exists "reports_select_team" on public.reports;
create policy "reports_select_team"
  on public.reports for select
  using (auth.role() = 'authenticated');

-- delete: dono OU admin
drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own"
  on public.reports for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_profiles up
      where up.user_id = auth.uid() and up.role = 'admin'
    )
  );

notify pgrst, 'reload schema';
