-- Disable legacy invite_code gate.
-- Onboarding is now enforced through Supabase email OTP verification only.

create or replace function public.claim_my_invitation_secure(p_account_id uuid default null)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select public.claim_my_invitation(p_account_id);
$$;

revoke all on function public.claim_my_invitation_secure(uuid) from public;
grant execute on function public.claim_my_invitation_secure(uuid) to authenticated;

update public.account_invitations
set meta = coalesce(meta, '{}'::jsonb)
  - 'invite_code_hash'
  - 'invite_code_generated_at'
  - 'invite_code_verified_at'
  - 'invite_code_verified_by'
  - 'invite_code_attempts'
  - 'invite_code_last_failed_at'
where status = 'PENDING'
  and (
    coalesce(meta, '{}'::jsonb) ? 'invite_code_hash'
    or coalesce(meta, '{}'::jsonb) ? 'invite_code_generated_at'
    or coalesce(meta, '{}'::jsonb) ? 'invite_code_verified_at'
    or coalesce(meta, '{}'::jsonb) ? 'invite_code_verified_by'
    or coalesce(meta, '{}'::jsonb) ? 'invite_code_attempts'
    or coalesce(meta, '{}'::jsonb) ? 'invite_code_last_failed_at'
  );
