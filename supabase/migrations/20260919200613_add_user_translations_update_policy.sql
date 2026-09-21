grant update on table public.user_translations to authenticated;

create policy "Users can update their own translations"
  on public.user_translations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
