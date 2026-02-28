-- Phase 47: SELECT policy on self_signup_attempts for platform admins
--
-- Context: self_signup_attempts was created in phase44 with RLS enabled
-- but no SELECT policy was defined. This means the table is readable only
-- via service_role (edge functions). Platform admins need read access for
-- abuse monitoring without requiring an edge function wrapper.

create policy "Platform admins can read signup attempts"
  on public.self_signup_attempts
  for select
  using (public.is_platform_admin());
