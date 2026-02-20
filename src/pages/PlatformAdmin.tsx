import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Leaf } from 'lucide-react';
import AppHeader from '../shared/components/AppHeader';
import ConfirmDialog from '../shared/components/ConfirmDialog';
import { useToast } from '../shared/components/ToastProvider';
import { PlatformAdminApi } from '../shared/api/admin/platformAdmin.api';
import { SupportAdminApi } from '../shared/api/admin/support.api';
import { PlatformAccount, PlatformAccountStatus } from '../shared/api/admin/types';

interface Props {
  header: {
    title: string;
    user: { name: string; role: string; avatarUrl?: string } | null;
    onHome: () => void;
    onProfile: () => void;
    onAdmin: () => void;
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

const PlatformAdmin: React.FC<Props> = ({ header }) => {
  const { pushToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountSlug, setNewAccountSlug] = useState('');
  const [newAccountAdminEmail, setNewAccountAdminEmail] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [supportEmail, setSupportEmail] = useState('');
  const [supportAccountId, setSupportAccountId] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const [accountToChangeStatus, setAccountToChangeStatus] = useState<{ account: PlatformAccount; status: PlatformAccountStatus } | null>(null);

  const sortedAccounts = useMemo(() => accounts, [accounts]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await PlatformAdminApi.getAccounts();
      setAccounts(data);
      if (!supportAccountId && data.length > 0) {
        setSupportAccountId(data[0].id);
      }
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Laden fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Accounts konnten nicht geladen werden.'
      });
    } finally {
      setLoading(false);
    }
  }, [pushToast, supportAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
        title: 'Account erstellt',
        message: `Der Account "${result.accountName || accountName}" wurde erstellt und der erste Admin eingeladen.`
      });

      await loadAccounts();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Erstellung fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Account konnte nicht erstellt werden.'
      });
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportAccountId || !supportEmail.trim()) return;

    setIsSendingReset(true);
    try {
      await SupportAdminApi.sendPasswordReset({
        accountId: supportAccountId,
        email: supportEmail.trim().toLowerCase()
      });

      setSupportEmail('');
      pushToast({
        type: 'success',
        title: 'Support-Aktion ausgeführt',
        message: 'Wenn ein passender Nutzer existiert, wurde ein Reset-Link versendet.'
      });
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Reset fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Reset-Link konnte nicht gesendet werden.'
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleAccountStatusChange = async () => {
    if (!accountToChangeStatus) return;
    try {
      await PlatformAdminApi.updateAccountStatus(accountToChangeStatus.account.id, accountToChangeStatus.status);
      pushToast({
        type: 'success',
        title: 'Account aktualisiert',
        message: `Status für ${accountToChangeStatus.account.name} ist jetzt ${accountToChangeStatus.status}.`
      });
      await loadAccounts();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Statuswechsel fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Account-Status konnte nicht geändert werden.'
      });
    } finally {
      setAccountToChangeStatus(null);
    }
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

      <AppHeader
        title={header.title}
        user={header.user}
        onHome={header.onHome}
        onProfile={header.onProfile}
        onAdmin={header.onAdmin}
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

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-xl font-bold text-slate-800">Support: Passwort-Reset-Link senden</h2>
              <form onSubmit={handleSendPasswordReset} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={e => setSupportEmail(e.target.value)}
                    className="w-full border-slate-300 rounded-lg p-2 text-sm"
                    placeholder="user@firma.de"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Firma/Account</label>
                  <select
                    value={supportAccountId}
                    onChange={e => setSupportAccountId(e.target.value)}
                    className="w-full border-slate-300 rounded-lg p-2 text-sm"
                    required
                  >
                    <option value="" disabled>Account wählen</option>
                    {sortedAccounts.map(account => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSendingReset || !supportAccountId}
                  className="px-4 py-2 rounded-lg bg-[#2663EB] text-white font-semibold disabled:opacity-60"
                >
                  {isSendingReset ? 'Sende...' : 'Reset-Link senden'}
                </button>
              </form>
              <p className="text-xs text-slate-500">
                Aus Sicherheitsgründen wird immer eine neutrale Erfolgsantwort angezeigt, um User-Enumeration zu verhindern.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Firmenverwaltung</h2>
              <div className="space-y-2">
                {sortedAccounts.map(account => {
                  const status = account.status || 'ACTIVE';
                  return (
                    <div key={account.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 border border-slate-200 rounded-lg p-3 items-center">
                      <div className="md:col-span-5">
                        <p className="font-semibold text-slate-800">{account.name}</p>
                        <p className="text-xs text-slate-500">Slug: {account.slug}</p>
                        <p className="text-xs text-slate-500">Erstellt: {formatDateTime(account.created_at)}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${statusBadgeClass(status)}`}>
                          {status}
                        </span>
                      </div>
                      <div className="md:col-span-5 flex flex-wrap gap-2 justify-start md:justify-end">
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
                          Sperren
                        </button>
                        <button
                          onClick={() => setAccountToChangeStatus({ account, status: 'ARCHIVED' })}
                          className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                          disabled={status === 'ARCHIVED'}
                        >
                          Archivieren
                        </button>
                      </div>
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
