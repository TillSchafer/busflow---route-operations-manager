import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Leaf, Plus } from 'lucide-react';
import AppHeader from '../shared/components/AppHeader';
import ConfirmDialog from '../shared/components/ConfirmDialog';
import { useToast } from '../shared/components/ToastProvider';
import { TeamAdminApi } from '../shared/api/admin/teamAdmin.api';
import { InvitationItem, InvitationRole, MembershipItem, MembershipRole } from '../shared/api/admin/types';
import { isFunctionAuthError } from '../shared/lib/supabaseFunctions';
import AppSelect, { AppSelectOption } from '../shared/components/form/AppSelect';

interface Props {
  currentUserId?: string;
  activeAccountId?: string | null;
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

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('de-DE');
};

const toActionErrorMessage = (error: unknown, fallback: string) => {
  if (isFunctionAuthError(error)) {
    return 'Sitzung ungültig/abgelaufen. Bitte neu anmelden.';
  }
  return error instanceof Error ? error.message : fallback;
};

const invitationRoleOptions: Array<AppSelectOption<InvitationRole>> = [
  { value: 'VIEWER', label: 'Nur Lesen (Standard)' },
  { value: 'DISPATCH', label: 'Disposition' },
  { value: 'ADMIN', label: 'Admin' },
];

const membershipRoleOptions: Array<AppSelectOption<MembershipRole>> = [
  { value: 'VIEWER', label: 'Nur Lesen' },
  { value: 'DISPATCH', label: 'Disposition' },
  { value: 'ADMIN', label: 'Admin' },
];

const TeamAdmin: React.FC<Props> = ({ currentUserId, activeAccountId, header }) => {
  const { pushToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [accountStatus, setAccountStatus] = useState<string>('ACTIVE');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitationRole>('VIEWER');
  const [isInviting, setIsInviting] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const [membershipToDelete, setMembershipToDelete] = useState<MembershipItem | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<InvitationItem | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const accountIsWritable = accountStatus === 'ACTIVE';

  const activeMembers = useMemo(
    () => memberships.filter(item => item.status === 'ACTIVE'),
    [memberships]
  );
  const activeAdmins = useMemo(
    () => memberships.filter(item => item.status === 'ACTIVE' && item.role === 'ADMIN'),
    [memberships]
  );

  const loadData = useCallback(async () => {
    if (!activeAccountId) {
      setMemberships([]);
      setInvitations([]);
      setAccountStatus('ACTIVE');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await TeamAdminApi.getTeamAdminData(activeAccountId);
      setMemberships(data.memberships);
      setInvitations(data.invitations);
      setAccountStatus(data.account?.status || 'ACTIVE');
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Laden fehlgeschlagen',
        message: toActionErrorMessage(error, 'Teamdaten konnten nicht geladen werden.')
      });
    } finally {
      setLoading(false);
    }
  }, [activeAccountId, pushToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInviteEmployee = async () => {
    if (!activeAccountId || !accountIsWritable) return;

    setIsInviting(true);
    try {
      const inviteResult = await TeamAdminApi.inviteTeamMember({ accountId: activeAccountId, email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setInviteRole('VIEWER');
      setIsInviteDialogOpen(false);
      if (inviteResult?.emailSent === false) {
        pushToast({ type: 'warning', title: 'Einladung erstellt', message: 'Die Einladung wurde gespeichert, aber die E-Mail konnte nicht gesendet werden. Bitte prüfen Sie die E-Mail-Konfiguration in Supabase.' });
      } else {
        pushToast({ type: 'success', title: 'Einladung gesendet', message: 'Mitarbeiter wurde eingeladen.' });
      }
      await loadData();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Einladung fehlgeschlagen',
        message: toActionErrorMessage(error, 'Einladung konnte nicht gesendet werden.')
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMembershipRole = async (membershipId: string, nextRole: MembershipRole) => {
    if (!activeAccountId || !accountIsWritable) return;
    try {
      await TeamAdminApi.updateMembershipRole(activeAccountId, membershipId, nextRole);
      pushToast({ type: 'success', title: 'Gespeichert', message: 'Rolle wurde aktualisiert.' });
      await loadData();
    } catch (error) {
      pushToast({ type: 'error', title: 'Aktualisierung fehlgeschlagen', message: toActionErrorMessage(error, 'Rolle konnte nicht aktualisiert werden.') });
    }
  };

  const handleDeleteUserHard = async () => {
    if (!activeAccountId || !membershipToDelete || !accountIsWritable) return;

    setIsDeletingUser(true);
    try {
      await TeamAdminApi.deleteUserHard(activeAccountId, membershipToDelete.user_id);
      pushToast({ type: 'success', title: 'User gelöscht', message: 'Nutzer wurde vollständig gelöscht.' });
      await loadData();
    } catch (error) {
      pushToast({ type: 'error', title: 'Aktion fehlgeschlagen', message: toActionErrorMessage(error, 'Aktion konnte nicht ausgeführt werden.') });
    } finally {
      setIsDeletingUser(false);
      setMembershipToDelete(null);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!activeAccountId || !invitationToRevoke || !accountIsWritable) return;

    try {
      await TeamAdminApi.revokeInvitation(activeAccountId, invitationToRevoke.id);
      pushToast({ type: 'success', title: 'Einladung widerrufen', message: 'Die Einladung wurde widerrufen.' });
      await loadData();
    } catch (error) {
      pushToast({ type: 'error', title: 'Aktion fehlgeschlagen', message: toActionErrorMessage(error, 'Aktion konnte nicht ausgeführt werden.') });
    }

    setInvitationToRevoke(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ConfirmDialog
        isOpen={!!membershipToDelete}
        title="User vollständig löschen"
        message={`Möchten Sie ${membershipToDelete?.profiles && !Array.isArray(membershipToDelete.profiles)
          ? (membershipToDelete.profiles.full_name || membershipToDelete.profiles.email)
          : 'dieses Mitglied'} wirklich vollständig löschen? Diese Aktion ist irreversibel.`}
        confirmText={isDeletingUser ? 'Lösche...' : 'User löschen'}
        cancelText="Abbrechen"
        type="danger"
        onConfirm={handleDeleteUserHard}
        onCancel={() => setMembershipToDelete(null)}
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
        onOwner={header.onOwner}
        onLogout={header.onLogout}
      />

      {isInviteDialogOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative z-[2001] bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
            <form
              className="p-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleInviteEmployee();
              }}
            >
              <h3 className="text-lg font-bold text-slate-900">User einladen</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">E-Mail</label>
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
                <AppSelect<InvitationRole>
                  value={inviteRole}
                  onChange={setInviteRole}
                  options={invitationRoleOptions}
                  disabled={isInviting}
                  ariaLabel="Startrolle waehlen"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteDialogOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
                  disabled={isInviting}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-lg bg-[#2663EB] text-white font-semibold disabled:opacity-60"
                >
                  {isInviting ? 'Sende...' : 'Einladen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm flex items-center justify-center">
            <Leaf className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Adminbereich</h2>
                <p className="text-sm text-slate-600">
                  Verwalten Sie Benutzer, Rollen und Einladungen für Ihren Firmen-Account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteDialogOpen(true)}
                disabled={!activeAccountId || !accountIsWritable}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent"
                title="User einladen"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {!activeAccountId ? (
              <div className="text-sm text-slate-600 border border-slate-200 rounded-lg p-4">
                Kein aktiver Firmen-Account zugewiesen. Bitte Plattform-Admin kontaktieren.
              </div>
            ) : (
              <>
                {!accountIsWritable && (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Dieser Account ist aktuell auf <strong>{accountStatus}</strong> gesetzt. Teamänderungen sind gesperrt.
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-700">Mitglieder ({activeMembers.length})</h3>
                  {memberships.map(item => {
                    const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
                    const isCurrentUser = item.user_id === currentUserId;
                    const isLastActiveAdmin = item.status === 'ACTIVE' && item.role === 'ADMIN' && activeAdmins.length <= 1;

                    return (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 border border-slate-200 rounded-lg p-3 items-center">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{profile?.full_name || profile?.email || 'Unbekannt'}</p>
                          <p className="text-xs text-slate-500">{profile?.email || item.user_id}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Rolle</label>
                          <AppSelect<MembershipRole>
                            value={item.role}
                            onChange={nextRole => handleUpdateMembershipRole(item.id, nextRole)}
                            options={membershipRoleOptions}
                            disabled={item.status !== 'ACTIVE' || isCurrentUser || !accountIsWritable}
                            ariaLabel="Mitgliederrolle waehlen"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                          <p className="text-sm text-slate-700">{item.status}</p>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => setMembershipToDelete(item)}
                            disabled={isCurrentUser || isLastActiveAdmin || item.status !== 'ACTIVE' || !accountIsWritable}
                            className="px-3 py-2 rounded-md text-sm font-semibold text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                          >
                            User löschen
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
                            disabled={!accountIsWritable}
                            className="px-3 py-2 rounded-md text-sm font-semibold text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
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
        )}
      </main>
    </div>
  );
};

export default TeamAdmin;
