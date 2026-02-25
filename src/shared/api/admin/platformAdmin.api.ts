import { invokeAuthedFunction } from '../../lib/supabaseFunctions';
import {
  DeleteAccountDryRunResult,
  DeleteAccountResult,
  MembershipItem,
  OwnerCompanyOverviewResult,
  OwnerOverviewCompany,
  OwnerUpdateAccountResult,
  PlatformAccount,
  PlatformAccountStatus,
} from './types';

type OwnerOverviewData = {
  accounts: PlatformAccount[];
  membersByAccountId: Record<string, MembershipItem[]>;
};

export const PlatformAdminApi = {
  async getOwnerOverview(): Promise<OwnerOverviewData> {
    const data = await invokeAuthedFunction<Record<string, never>, OwnerCompanyOverviewResult>(
      'owner-company-overview-v1',
      {}
    );

    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Owner-Übersicht konnte nicht geladen werden.');
    }

    const companies = (data.companies || []) as OwnerOverviewCompany[];
    const accounts = companies.map(({ members: _members, ...account }) => account as PlatformAccount);
    const membersByAccountId = Object.fromEntries(
      companies.map(company => [company.id, company.members || []])
    );

    return { accounts, membersByAccountId };
  },

  async provisionAccount(payload: { accountName: string; accountSlug: string; adminEmail: string }) {
    const data = await invokeAuthedFunction<
      { accountName: string; accountSlug: string; adminEmail: string },
      { ok: boolean; message?: string; code?: string; accountName?: string }
    >('platform-provision-account', payload);

    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Firma konnte nicht angelegt werden.');
    }

    return data;
  },

  async updateAccount(
    accountId: string,
    payload: { status?: PlatformAccountStatus; name?: string; slug?: string; reason?: string }
  ): Promise<OwnerUpdateAccountResult> {
    const data = await invokeAuthedFunction<
      { accountId: string; status?: PlatformAccountStatus; name?: string; slug?: string; reason?: string },
      OwnerUpdateAccountResult
    >('owner-update-account-v1', { accountId, ...payload });

    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Account konnte nicht aktualisiert werden.');
    }

    return data as OwnerUpdateAccountResult;
  },

  async updateAccountTrial(
    accountId: string,
    trialAction: 'EXTEND_14_DAYS' | 'CANCEL_TRIAL',
    reason?: string
  ): Promise<OwnerUpdateAccountResult> {
    const data = await invokeAuthedFunction<
      { accountId: string; trialAction: 'EXTEND_14_DAYS' | 'CANCEL_TRIAL'; reason?: string },
      OwnerUpdateAccountResult
    >('owner-update-account-v1', { accountId, trialAction, reason });

    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Trial-Status konnte nicht aktualisiert werden.');
    }

    return data as OwnerUpdateAccountResult;
  },

  async deleteAccountDryRun(accountId: string): Promise<DeleteAccountDryRunResult> {
    const data = await invokeAuthedFunction<
      { accountId: string; dryRun: boolean },
      DeleteAccountDryRunResult
    >('platform-delete-account', { accountId, dryRun: true });

    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Dry-Run für Firmenlöschung fehlgeschlagen.');
    }

    return data as DeleteAccountDryRunResult;
  },

  async deleteAccountHard(accountId: string, confirmSlug: string, reason?: string): Promise<DeleteAccountResult> {
    const data = await invokeAuthedFunction<
      { accountId: string; dryRun: boolean; confirmSlug: string; reason?: string },
      DeleteAccountResult
    >('platform-delete-account', { accountId, dryRun: false, confirmSlug, reason });

    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Firma konnte nicht gelöscht werden.');
    }

    return data as DeleteAccountResult;
  },
};
