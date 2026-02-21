import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Leaf } from 'lucide-react';
import AppHeader from '../shared/components/AppHeader';
import ConfirmDialog from '../shared/components/ConfirmDialog';
import { useToast } from '../shared/components/ToastProvider';
import { PlatformAdminApi } from '../shared/api/admin/platformAdmin.api';
import { MembershipItem, PlatformAccount, PlatformAccountStatus } from '../shared/api/admin/types';
import { isFunctionAuthError } from '../shared/lib/supabaseFunctions';

interface Props {
  header: {
    title: string;
    user: { name: string; role: 'ADMIN' | 'DISPATCH' | 'VIEWER'; avatarUrl?: string; isPlatformOwner?: boolean } | null;
    onHome: () => void;
    onProfile: () => void;
    onAdmin: () => void;
    onOwner?: () => void;
    onLogout: () => void;
  };
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('de-DE');
};

const statusBadgeClass = (status?: PlatformAccountStatus) => {
  if (status === 'SUSPENDED') return 'bg-amber-100 text-amber-700';
  if (status === 'ARCHIVED') return 'bg-slate-200 text-slate-700';
  return 'bg-emerald-100 text-emerald-700';
};

const profileFromMembership = (membership: MembershipItem) => {
  if (Array.isArray(membership.profiles)) return membership.profiles[0] || null;
  return membership.profiles;
};

const memberDisplayName = (membership: MembershipItem) => {
  const profile = profileFromMembership(membership);
  return profile?.full_name || profile?.email || membership.user_id;
};

const memberDisplayEmail = (membership: MembershipItem) => {
  const profile = profileFromMembership(membership);
  return profile?.email || membership.user_id;
};

const toActionErrorMessage = (error: unknown, fallback: string) => {
  if (isFunctionAuthError(error)) {
    return 'Sitzung ungültig/abgelaufen. Bitte neu anmelden.';
  }
  return error instanceof Error ? error.message : fallback;
};

const PlatformAdmin: React.FC<Props> = ({ header }) => {
  const { pushToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [accountMembersByAccountId, setAccountMembersByAccountId] = useState<Record<string, MembershipItem[]>>({});
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({});

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountSlug, setNewAccountSlug] = useState('');
  const [newAccountAdminEmail, setNewAccountAdminEmail] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [accountToChangeStatus, setAccountToChangeStatus] = useState<{ account: PlatformAccount; status: PlatformAccountStatus } | null>(null);

  const [accountToEdit, setAccountToEdit] = useState<PlatformAccount | null>(null);
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountSlug, setEditAccountSlug] = useState('');
  const [editAccountReason, setEditAccountReason] = useState('');
  const [isSavingAccountEdit, setIsSavingAccountEdit] = useState(false);

  const [accountToDelete, setAccountToDelete] = useState<PlatformAccount | null>(null);
  const [accountDeleteSlugInput, setAccountDeleteSlugInput] = useState('');
  const [accountDeleteReason, setAccountDeleteReason] = useState('');
  const [accountDeleteDryRun, setAccountDeleteDryRun] = useState<{
    routes: number;
    stops: number;
    customers: number;
    contacts: number;
    workers: number;
    busTypes: number;
    appSettings: number;
    memberships: number;
    invitations: number;
    users: number;
  } | null>(null);
  const [isRunningDeleteDryRun, setIsRunningDeleteDryRun] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const sortedAccounts = useMemo(() => accounts, [accounts]);

  const loadOwnerOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await PlatformAdminApi.getOwnerOverview();
      setAccounts(data.accounts);
      setAccountMembersByAccountId(data.membersByAccountId);
      setExpandedAccountIds(prev => {
        const next = { ...prev };
        for (const account of data.accounts) {
          if (typeof next[account.id] === 'undefined') {
            next[account.id] = false;
          }
        }
        return next;
      });
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Laden fehlgeschlagen',
        message: toActionErrorMessage(error, 'Owner-Übersicht konnte nicht geladen werden.')
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    loadOwnerOverview();
  }, [loadOwnerOverview]);

  const handleCreateAccountAndInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAccount(true);

    try {
      const accountName = newAccountName.trim();
      const accountSlug = (newAccountSlug.trim() || slugify(accountName));
      const adminEmail = newAccountAdminEmail.trim().toLowerCase();

      if (!accountName || !accountSlug || !adminEmail) {
        throw new Error('Name, Slug und Admin-E-Mail sind erforderlich.');
      }

      const result = await PlatformAdminApi.provisionAccount({ accountName, accountSlug, adminEmail });

      setNewAccountName('');
      setNewAccountSlug('');
      setNewAccountAdminEmail('');

      pushToast({
        type: 'success',
        title: 'Firma erstellt',
        message: `Der Account "${result.accountName || accountName}" wurde erstellt und der erste Admin eingeladen.`
      });

      await loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Erstellung fehlgeschlagen',
        message: toActionErrorMessage(error, 'Firma konnte nicht erstellt werden.')
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const openEditAccountDialog = (account: PlatformAccount) => {
    setAccountToEdit(account);
    setEditAccountName(account.name || '');
    setEditAccountSlug(account.slug || '');
    setEditAccountReason('');
  };

  const handleSaveAccountEdit = async () => {
    if (!accountToEdit) return;
    const nextName = editAccountName.trim();
    const nextSlug = slugify(editAccountSlug.trim());
    if (!nextName || !nextSlug) {
      pushToast({
        type: 'error',
        title: 'Ungültige Eingabe',
        message: 'Name und Slug sind erforderlich.'
      });
      return;
    }

    setIsSavingAccountEdit(true);
    try {
      await PlatformAdminApi.updateAccount(accountToEdit.id, {
        name: nextName,
        slug: nextSlug,
        reason: editAccountReason.trim() || undefined,
      });
      pushToast({
        type: 'success',
        title: 'Firma aktualisiert',
        message: `Firma "${nextName}" wurde aktualisiert.`
      });
      setAccountToEdit(null);
      await loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Aktualisierung fehlgeschlagen',
        message: toActionErrorMessage(error, 'Firma konnte nicht aktualisiert werden.')
      });
    } finally {
      setIsSavingAccountEdit(false);
    }
  };

  const handleAccountStatusChange = async () => {
    if (!accountToChangeStatus) return;
    try {
      await PlatformAdminApi.updateAccount(accountToChangeStatus.account.id, { status: accountToChangeStatus.status });
      pushToast({
        type: 'success',
        title: 'Status aktualisiert',
        message: `Status für ${accountToChangeStatus.account.name} ist jetzt ${accountToChangeStatus.status}.`
      });
      await loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Statuswechsel fehlgeschlagen',
        message: toActionErrorMessage(error, 'Account-Status konnte nicht geändert werden.')
      });
    } finally {
      setAccountToChangeStatus(null);
    }
  };

  const openDeleteAccountDialog = async (account: PlatformAccount) => {
    setAccountToDelete(account);
    setAccountDeleteSlugInput('');
    setAccountDeleteReason('');
    setAccountDeleteDryRun(null);
    setIsRunningDeleteDryRun(true);

    try {
      const dryRun = await PlatformAdminApi.deleteAccountDryRun(account.id);
      setAccountDeleteDryRun(dryRun.counts || null);
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Dry-Run fehlgeschlagen',
        message: toActionErrorMessage(error, 'Dry-Run konnte nicht geladen werden.')
      });
    } finally {
      setIsRunningDeleteDryRun(false);
    }
  };

  const handleDeleteAccountHard = async () => {
    if (!accountToDelete) return;
    if (!accountDeleteSlugInput.trim()) {
      pushToast({ type: 'error', title: 'Bestätigung fehlt', message: 'Bitte den Slug zur Bestätigung eingeben.' });
      return;
    }

    setIsDeletingAccount(true);
    try {
      await PlatformAdminApi.deleteAccountHard(accountToDelete.id, accountDeleteSlugInput.trim(), accountDeleteReason.trim() || undefined);
      pushToast({
        type: 'success',
        title: 'Firma gelöscht',
        message: `Der Account "${accountToDelete.name}" wurde vollständig gelöscht.`
      });
      setAccountToDelete(null);
      setAccountDeleteSlugInput('');
      setAccountDeleteReason('');
      setAccountDeleteDryRun(null);
      await loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Löschen fehlgeschlagen',
        message: toActionErrorMessage(error, 'Firma konnte nicht gelöscht werden.')
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const toggleAccountExpanded = (accountId: string) => {
    setExpandedAccountIds(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ConfirmDialog
        isOpen={!!accountToChangeStatus}
        title="Account-Status ändern"
        message={accountToChangeStatus
          ? `Soll der Account "${accountToChangeStatus.account.name}" auf "${accountToChangeStatus.status}" gesetzt werden?`
          : ''}
        confirmText="Bestätigen"
        cancelText="Abbrechen"
        type="warning"
        onConfirm={handleAccountStatusChange}
        onCancel={() => setAccountToChangeStatus(null)}
      />

      {accountToEdit && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative z-[2001] bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Firma bearbeiten</h3>
              <p className="text-sm text-slate-600">Account-ID: {accountToEdit.id}</p>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Firmenname</label>
                <input
                  type="text"
                  value={editAccountName}
                  onChange={e => setEditAccountName(e.target.value)}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="Firmenname"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Slug</label>
                <input
                  type="text"
                  value={editAccountSlug}
                  onChange={e => setEditAccountSlug(slugify(e.target.value))}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="firmen-slug"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Grund (optional)</label>
                <input
                  type="text"
                  value={editAccountReason}
                  onChange={e => setEditAccountReason(e.target.value)}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="z. B. Stammdaten-Korrektur"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setAccountToEdit(null)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                  disabled={isSavingAccountEdit}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveAccountEdit}
                  disabled={isSavingAccountEdit || !editAccountName.trim() || !editAccountSlug.trim()}
                  className="px-4 py-2 rounded-lg text-white font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSavingAccountEdit ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {accountToDelete && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative z-[2001] bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Firma vollständig löschen</h3>
              <p className="text-sm text-slate-600">
                Account: <strong>{accountToDelete.name}</strong> ({accountToDelete.slug})
              </p>

              {isRunningDeleteDryRun ? (
                <p className="text-sm text-slate-500">Dry-Run wird geladen...</p>
              ) : (
                <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="font-semibold mb-2">Betroffene Datensätze (Dry-Run):</p>
                  <p>Routen: {accountDeleteDryRun?.routes ?? 0}</p>
                  <p>Halte: {accountDeleteDryRun?.stops ?? 0}</p>
                  <p>Kunden: {accountDeleteDryRun?.customers ?? 0}</p>
                  <p>Kontakte: {accountDeleteDryRun?.contacts ?? 0}</p>
                  <p>Mitarbeiter: {accountDeleteDryRun?.workers ?? 0}</p>
                  <p>Bustypen: {accountDeleteDryRun?.busTypes ?? 0}</p>
                  <p>App Settings: {accountDeleteDryRun?.appSettings ?? 0}</p>
                  <p>Memberships: {accountDeleteDryRun?.memberships ?? 0}</p>
                  <p>Einladungen: {accountDeleteDryRun?.invitations ?? 0}</p>
                  <p>Betroffene User: {accountDeleteDryRun?.users ?? 0}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Zur Bestätigung Slug eingeben: <span className="text-slate-900">{accountToDelete.slug}</span>
                </label>
                <input
                  type="text"
                  value={accountDeleteSlugInput}
                  onChange={e => setAccountDeleteSlugInput(e.target.value)}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="Slug eingeben"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Grund (optional)</label>
                <input
                  type="text"
                  value={accountDeleteReason}
                  onChange={e => setAccountDeleteReason(e.target.value)}
                  className="w-full border-slate-300 rounded-lg p-2 text-sm"
                  placeholder="z. B. Testaccount-Bereinigung"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setAccountToDelete(null);
                    setAccountDeleteSlugInput('');
                    setAccountDeleteReason('');
                    setAccountDeleteDryRun(null);
                  }}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteAccountHard}
                  disabled={isDeletingAccount || accountDeleteSlugInput.trim() !== accountToDelete.slug}
                  className="px-4 py-2 rounded-lg text-white font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingAccount ? 'Lösche...' : 'Firma endgültig löschen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AppHeader
        title={header.title}
        user={header.user}
        onHome={header.onHome}
        onProfile={header.onProfile}
        onAdmin={header.onAdmin}
        onOwner={header.onOwner}
        onLogout={header.onLogout}
      />

      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm flex items-center justify-center">
            <Leaf className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-xl font-bold text-slate-800">Firma anlegen + ersten Admin einladen</h2>
              <form onSubmit={handleCreateAccountAndInviteAdmin} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Firmenname</label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={e => {
                      const name = e.target.value;
                      setNewAccountName(name);
                      if (!newAccountSlug.trim()) {
                        setNewAccountSlug(slugify(name));
                      }
                    }}
                    className="w-full border-slate-300 rounded-lg p-2 text-sm"
                    placeholder="z. B. Muster Logistik GmbH"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Slug</label>
                  <input
                    type="text"
                    value={newAccountSlug}
                    onChange={e => setNewAccountSlug(slugify(e.target.value))}
                    className="w-full border-slate-300 rounded-lg p-2 text-sm"
                    placeholder="muster-logistik"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Erste Admin-E-Mail</label>
                  <input
                    type="email"
                    value={newAccountAdminEmail}
                    onChange={e => setNewAccountAdminEmail(e.target.value)}
                    className="w-full border-slate-300 rounded-lg p-2 text-sm"
                    placeholder="admin@firma.de"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingAccount}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-60"
                >
                  {isCreatingAccount ? 'Verarbeite...' : 'Firma + Admin anlegen'}
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Owner Bereich: Firmen und User</h2>
              <div className="space-y-3">
                {sortedAccounts.map(account => {
                  const status = account.status || 'ACTIVE';
                  const members = accountMembersByAccountId[account.id] || [];
                  const isExpanded = !!expandedAccountIds[account.id];

                  return (
                    <div key={account.id} className="border border-slate-200 rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <button
                          onClick={() => toggleAccountExpanded(account.id)}
                          className="md:col-span-4 text-left"
                        >
                          <p className="font-semibold text-slate-800 flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            {account.name}
                          </p>
                          <p className="text-xs text-slate-500">Slug: {account.slug}</p>
                          <p className="text-xs text-slate-500">Erstellt: {formatDateTime(account.created_at)}</p>
                        </button>

                        <div className="md:col-span-2">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${statusBadgeClass(status)}`}>
                            {status}
                          </span>
                        </div>

                        <div className="md:col-span-1 text-xs text-slate-500">
                          {members.length} User
                        </div>

                        <div className="md:col-span-5 flex flex-wrap gap-2 justify-start md:justify-end">
                          <button
                            onClick={() => openEditAccountDialog(account)}
                            className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => setAccountToChangeStatus({ account, status: 'ACTIVE' })}
                            className="px-3 py-1.5 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            disabled={status === 'ACTIVE'}
                          >
                            Aktivieren
                          </button>
                          <button
                            onClick={() => setAccountToChangeStatus({ account, status: 'SUSPENDED' })}
                            className="px-3 py-1.5 text-xs rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                            disabled={status === 'SUSPENDED'}
                          >
                            Pausieren
                          </button>
                          <button
                            onClick={() => setAccountToChangeStatus({ account, status: 'ARCHIVED' })}
                            className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                            disabled={status === 'ARCHIVED'}
                          >
                            Archivieren
                          </button>
                          <button
                            onClick={() => openDeleteAccountDialog(account)}
                            className="px-3 py-1.5 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
                          >
                            Firma löschen
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="space-y-2 border-t border-slate-100 pt-3">
                          {members.length === 0 ? (
                            <p className="text-sm text-slate-500">Keine User gefunden.</p>
                          ) : (
                            members.map(member => (
                              <div key={member.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm border border-slate-100 rounded-md p-2">
                                <p className="font-medium text-slate-800">{memberDisplayName(member)}</p>
                                <p className="text-slate-600">{memberDisplayEmail(member)}</p>
                                <p className="text-slate-600">Rolle: {member.role}</p>
                                <p className="text-slate-600">Status: {member.status}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sortedAccounts.length === 0 && (
                  <p className="text-sm text-slate-500">Noch keine Firmen angelegt.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PlatformAdmin;
