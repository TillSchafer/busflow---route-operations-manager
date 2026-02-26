import type { PlatformAccountStatus, TrialState, MembershipItem } from '../../../../shared/api/admin/types';

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('de-DE');
};

export const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE');
};

export const statusBadgeClass = (status?: PlatformAccountStatus) => {
  if (status === 'SUSPENDED') return 'bg-amber-100 text-amber-700';
  if (status === 'ARCHIVED') return 'bg-slate-200 text-slate-700';
  return 'bg-emerald-100 text-emerald-700';
};

export const trialBadgeClass = (trialState?: TrialState) => {
  if (trialState === 'TRIAL_ACTIVE') return 'bg-blue-100 text-blue-700';
  if (trialState === 'TRIAL_ENDED') return 'bg-red-100 text-red-700';
  return 'bg-emerald-100 text-emerald-700';
};

export const isLastActiveAdmin = (item: MembershipItem, activeAdminCount: number): boolean =>
  item.status === 'ACTIVE' && item.role === 'ADMIN' && activeAdminCount <= 1;
