import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../shared/lib/supabase';
import { invokeAuthedFunction } from '../shared/lib/supabaseFunctions';
import AppHeader from '../shared/components/AppHeader';
import { Leaf } from 'lucide-react';
import { useToast } from '../shared/components/ToastProvider';
import ConfirmDialog from '../shared/components/ConfirmDialog';

interface AppCard {
  id: string;
  title: string;
}

type MembershipRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';
type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';
type InvitationRole = 'ADMIN' | 'DISPATCH' | 'VIEWER';
type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

interface MembershipItem {
  id: string;
  account_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  profiles: { id: string; email: string; full_name: string } | { id: string; email: string; full_name: string }[] | null;
}

interface InvitationItem {
  id: string;
  account_id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

interface PlatformAccount {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface Props {
  apps: AppCard[];
  currentUserId?: string;
  activeAccountId?: string | null;
  isPlatformAdmin?: boolean;
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

const Admin: React.FC<Props> = ({ apps: _apps, currentUserId, activeAccountId, isPlatformAdmin = false, header }) => {
  const { pushToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitationRole>('VIEWER');
  const [isInviting, setIsInviting] = useState(false);

  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountSlug, setNewAccountSlug] = useState('');
  const [newAccountAdminEmail, setNewAccountAdminEmail] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const [membershipToSuspend, setMembershipToSuspend] = useState<MembershipItem | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<InvitationItem | null>(null);

  const activeMembers = useMemo(
    () => memberships.filter(item => item.status === 'ACTIVE'),
    [memberships]
  );

  const invokeInvite = useCallback(async (payload: { accountId: string; email: string; role: InvitationRole }) => {
    const data = await invokeAuthedFunction<
      { accountId: string; email: string; role: InvitationRole },
      { ok: boolean; message?: string; code?: string }
    >('invite-account-user', payload);

    if (!data?.ok) {
      throw new Error(data?.message || data?.code || 'Einladung konnte nicht erstellt werden.');
    }

    return data;
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!isPlatformAdmin) {
      setAccounts([]);
      return;
    }

    const { data, error } = await supabase
      .from('platform_accounts')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    setAccounts((data || []) as PlatformAccount[]);
  }, [isPlatformAdmin]);

  const loadTenantAdminData = useCallback(async () => {
    if (!activeAccountId) {
      setMemberships([]);
      setInvitations([]);
      return;
    }

    const [membershipsRes, invitationsRes] = await Promise.all([
      supabase
        .from('account_memberships')
        .select(`
          id,
          account_id,
          user_id,
          role,
          status,
          created_at,
          profiles!inner(id, email, full_name)
        `)
        .eq('account_id', activeAccountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('account_invitations')
        .select('id, account_id, email, role, status, expires_at, created_at')
        .eq('account_id', activeAccountId)
        .order('created_at', { ascending: false })
    ]);

    if (membershipsRes.error) {
      throw membershipsRes.error;
    }
    if (invitationsRes.error) {
      throw invitationsRes.error;
    }

    setMemberships((membershipsRes.data || []) as MembershipItem[]);
    setInvitations((invitationsRes.data || []) as InvitationItem[]);
  }, [activeAccountId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadAccounts(), loadTenantAdminData()]);
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Laden fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Admin-Daten konnten nicht geladen werden.'
      });
    } finally {
      setLoading(false);
    }
  }, [loadAccounts, loadTenantAdminData, pushToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInviteEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) {
      pushToast({ type: 'error', title: 'Kein Account', message: 'Kein aktiver Account verfügbar.' });
      return;
    }

    setIsInviting(true);
    try {
      await invokeInvite({ accountId: activeAccountId, email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setInviteRole('VIEWER');
      pushToast({ type: 'success', title: 'Einladung gesendet', message: 'Mitarbeiter wurde eingeladen.' });
      await loadTenantAdminData();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Einladung fehlgeschlagen',
        message: error instanceof Error ? error.message : 'Einladung konnte nicht gesendet werden.'
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMembershipRole = async (membershipId: string, nextRole: MembershipRole) => {
    if (!activeAccountId) return;
    const { error } = await supabase
      .from('account_memberships')
      .update({ role: nextRole })
      .eq('account_id', activeAccountId)
      .eq('id', membershipId);

    if (error) {
      pushToast({ type: 'error', title: 'Aktualisierung fehlgeschlagen', message: error.message });
      return;
    }

    pushToast({ type: 'success', title: 'Gespeichert', message: 'Rolle wurde aktualisiert.' });
    await loadTenantAdminData();
  };

  const handleSuspendMembership = async () => {
    if (!activeAccountId || !membershipToSuspend) return;

    const { error } = await supabase
      .from('account_memberships')
      .update({ status: 'SUSPENDED' })
      .eq('account_id', activeAccountId)
      .eq('id', membershipToSuspend.id);

    if (error) {
      pushToast({ type: 'error', title: 'Aktion fehlgeschlagen', message: error.message });
    } else {
      pushToast({ type: 'success', title: 'Zugriff entzogen', message: 'Mitglied wurde deaktiviert.' });
      await loadTenantAdminData();
    }

    setMembershipToSuspend(null);
  };

  const handleRevokeInvitation = async () => {
    if (!activeAccountId || !invitationToRevoke) return;

    const { error } = await supabase
      .from('account_invitations')
      .update({ status: 'REVOKED' })
      .eq('account_id', activeAccountId)
      .eq('id', invitationToRevoke.id)
      .eq('status', 'PENDING');

    if (error) {
      pushToast({ type: 'error', title: 'Aktion fehlgeschlagen', message: error.message });
    } else {
      pushToast({ type: 'success', title: 'Einladung widerrufen', message: 'Die Einladung wurde widerrufen.' });
      await loadTenantAdminData();
    }

    setInvitationToRevoke(null);
  };

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

      const { data: account, error: createError } = await supabase
        .from('platform_accounts')
        .insert({ name: accountName, slug: accountSlug })
        .select('id, name')
        .single();

      if (createError || !account) {
        throw createError || new Error('Account konnte nicht erstellt werden.');
      }

      await invokeInvite({ accountId: account.id, email: adminEmail, role: 'ADMIN' });

      setNewAccountName('');
      setNewAccountSlug('');
      setNewAccountAdminEmail('');

      pushToast({
        type: 'success',
        title: 'Account erstellt',
        message: `Der Account "${account.name}" wurde erstellt und der erste Admin eingeladen.`
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

  return (
    <div className="min-h-screen flex flex-col">
      <ConfirmDialog
        isOpen={!!membershipToSuspend}
        title="Mitglied deaktivieren"
        message={`Möchten Sie den Zugriff für ${membershipToSuspend?.profiles && !Array.isArray(membershipToSuspend.profiles)
          ? (membershipToSuspend.profiles.full_name || membershipToSuspend.profiles.email)
          : 'dieses Mitglied'} wirklich entziehen?`}
        confirmText="Deaktivieren"
        cancelText="Abbrechen"
        type="danger"
        onConfirm={handleSuspendMembership}
        onCancel={() => setMembershipToSuspend(null)}
      />

      <ConfirmDialog
        isOpen={!!invitationToRevoke}
        title="Einladung widerrufen"
        message={`Soll die Einladung an ${invitationToRevoke?.email || 'diese E-Mail-Adresse'} widerrufen werden?`}
        confirmText="Widerrufen"
        cancelText="Abbrechen"
        type="danger"
        onConfirm={handleRevokeInvitation}
        onCancel={() => setInvitationToRevoke(null)}
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
            {isPlatformAdmin && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <h2 className="text-xl font-bold text-slate-800">Plattform: Firma anlegen + ersten Admin einladen</h2>
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

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Bestehende Firmen</h3>
                  <div className="space-y-2">
                    {accounts.map(account => (
                      <div key={account.id} className="flex items-center justify-between text-sm border border-slate-200 rounded-lg p-3">
                        <div>
                          <p className="font-semibold text-slate-800">{account.name}</p>
                          <p className="text-slate-500">Slug: {account.slug}</p>
                        </div>
                        <p className="text-slate-500">Erstellt: {formatDateTime(account.created_at)}</p>
                      </div>
                    ))}
                    {accounts.length === 0 && (
                      <p className="text-sm text-slate-500">Noch keine Firmen angelegt.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <h2 className="text-xl font-bold text-slate-800">Teamverwaltung</h2>

              {!activeAccountId ? (
                <div className="text-sm text-slate-600 border border-slate-200 rounded-lg p-4">
                  Kein aktiver Firmen-Account zugewiesen. Bitte Plattform-Admin kontaktieren.
                </div>
              ) : (
                <>
                  <form onSubmit={handleInviteEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Mitarbeiter einladen (E-Mail)</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="w-full border-slate-300 rounded-lg p-2 text-sm"
                        placeholder="mitarbeiter@firma.de"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Startrolle</label>
                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as InvitationRole)}
                        className="w-full border-slate-300 rounded-lg p-2 text-sm"
                      >
                        <option value="VIEWER">Nur Lesen (Standard)</option>
                        <option value="DISPATCH">Disposition</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isInviting}
                      className="px-4 py-2 rounded-lg bg-[#2663EB] text-white font-semibold disabled:opacity-60"
                    >
                      {isInviting ? 'Sende...' : 'Einladen'}
                    </button>
                  </form>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-700">Mitglieder ({activeMembers.length})</h3>
                    {memberships.map(item => {
                      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
                      const isCurrentUser = profile?.id === currentUserId;

                      return (
                        <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-slate-200 rounded-lg p-3 items-center">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{profile?.full_name || profile?.email || 'Unbekannt'}</p>
                            <p className="text-xs text-slate-500">{profile?.email || '-'}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Rolle</label>
                            <select
                              value={item.role}
                              onChange={e => handleUpdateMembershipRole(item.id, e.target.value as MembershipRole)}
                              className="w-full border-slate-300 rounded-lg p-2 text-sm"
                              disabled={item.status !== 'ACTIVE' || isCurrentUser}
                            >
                              <option value="VIEWER">Nur Lesen</option>
                              <option value="DISPATCH">Disposition</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                            <p className="text-sm text-slate-700">{item.status}</p>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => setMembershipToSuspend(item)}
                              disabled={isCurrentUser || item.status !== 'ACTIVE'}
                              className="px-3 py-2 rounded-md text-sm font-semibold text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                            >
                              Zugriff entziehen
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {memberships.length === 0 && (
                      <p className="text-sm text-slate-500">Noch keine Teammitglieder vorhanden.</p>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <h3 className="text-sm font-bold text-slate-700">Offene Einladungen</h3>
                    {invitations
                      .filter(inv => inv.status === 'PENDING')
                      .map(inv => (
                        <div key={inv.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-slate-200 rounded-lg p-3 items-center">
                          <div className="md:col-span-2">
                            <p className="font-semibold text-slate-900 text-sm">{inv.email}</p>
                            <p className="text-xs text-slate-500">Rolle: {inv.role}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Läuft ab</p>
                            <p className="text-sm text-slate-700">{formatDateTime(inv.expires_at)}</p>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => setInvitationToRevoke(inv)}
                              className="px-3 py-2 rounded-md text-sm font-semibold text-red-600 hover:bg-red-50"
                            >
                              Widerrufen
                            </button>
                          </div>
                        </div>
                      ))}

                    {invitations.filter(inv => inv.status === 'PENDING').length === 0 && (
                      <p className="text-sm text-slate-500">Keine offenen Einladungen.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Admin;
