begin;
alter policy own_profile_insert on public.member_profiles with check ((select auth.uid()) = user_id);
alter policy own_profile_update on public.member_profiles using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy own_plan_read on public.member_plans using ((select auth.uid()) = user_id);
alter policy own_logs_insert on public.member_logs with check ((select auth.uid()) = user_id);
alter policy own_logs_update on public.member_logs using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;