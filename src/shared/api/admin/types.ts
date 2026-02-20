export type MembershipRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';
export type InvitationRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
export type PlatformAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface MembershipItem {
  id: string;
  account_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  profiles: { id: string; email: string; full_name: string } | { id: string; email: string; full_name: string }[] | null;
}

export interface InvitationItem {
  id: string;
  account_id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

export interface PlatformAccount {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  status?: PlatformAccountStatus;
  updated_at?: string;
  archived_at?: string | null;
  archived_by?: string | null;
}
