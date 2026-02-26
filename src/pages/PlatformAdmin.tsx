import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Leaf, X } from 'lucide-react';
import AppHeader from '../shared/components/AppHeader';
import ConfirmDialog from '../shared/components/ConfirmDialog';
import { useToast } from '../shared/components/ToastProvider';
import { PlatformAdminApi } from '../shared/api/admin/platformAdmin.api';
import { MembershipItem, PlatformAccount, PlatformAccountStatus, TrialState } from '../shared/api/admin/types';
import { toActionErrorMessage } from '../shared/lib/error-mapping';
import {
  formatDate,
  formatDateTime,
  slugify,
  statusBadgeClass,
  trialBadgeClass,
} from '../features/admin/shared/lib/admin-ui';

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

type DryRunCounts = {
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
};

const trialDaysRemaining = (trialEndsAt: string): number => {
  const diffMs = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
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

const PlatformAdmin: React.FC<Props> = ({ header }) => {
  const { pushToast } = useToast();

  // --- List state ---
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [accountMembersByAccountId, setAccountMembersByAccountId] = useState<Record<string, MembershipItem[]>>({});
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({});

  // --- Create account form ---
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountSlug, setNewAccountSlug] = useState('');
  const [newAccountAdminEmail, setNewAccountAdminEmail] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // --- Edit modal core ---
  const [editAccount, setEditAccount] = useState<PlatformAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [editReason, setEditReason] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // --- Unsaved guard ---
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // --- Archive / Reactivate ---
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // --- Delete step (inside modal) ---
  const [showDeleteStep, setShowDeleteStep] = useState(false);
  const [deleteSlugInput, setDeleteSlugInput] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteDryRun, setDeleteDryRun] = useState<DryRunCounts | null>(null);
  const [isRunningDeleteDryRun, setIsRunningDeleteDryRun] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // --- Trial actions ---
  const [pendingTrialAction, setPendingTrialAction] = useState<'EXTEND_14_DAYS' | 'CANCEL_TRIAL' | null>(null);
  const [trialActionReason, setTrialActionReason] = useState('');
  const [isUpdatingTrial, setIsUpdatingTrial] = useState(false);

  // --- Computed dirty state ---
  const isDirty = useMemo(() => {
    if (!editAccount) return false;
    const nameChanged = editName.trim() !== editAccount.name;
    const slugChanged = editSlug !== editAccount.slug;
    const originalStatus: 'ACTIVE' | 'SUSPENDED' = editAccount.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    const statusChanged = editAccount.status !== 'ARCHIVED' && editStatus !== originalStatus;
    return nameChanged || slugChanged || statusChanged;
  }, [editAccount, editName, editSlug, editStatus]);

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // --- ESC key handler ---
  useEffect(() => {
    if (!editAccount) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showDiscardConfirm || showArchiveConfirm || showReactivateConfirm || pendingTrialAction) return;
      if (isDirtyRef.current) {
        setShowDiscardConfirm(true);
      } else {
        closeEditDialog();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editAccount, showDiscardConfirm, showArchiveConfirm, showReactivateConfirm, pendingTrialAction]);

  // --- Data loading ---
  const loadOwnerOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await PlatformAdminApi.getOwnerOverview();
      setAccounts(data.accounts);
      setAccountMembersByAccountId(data.membersByAccountId);
      setExpandedAccountIds(prev => {
        const next = { ...prev };
        for (const account of data.accounts) {
          if (typeof next[account.id] === 'undefined') next[account.id] = false;
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

  useEffect(() => { loadOwnerOverview(); }, [loadOwnerOverview]);

  // --- Create account ---
  const handleCreateAccountAndInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAccount(true);
    try {
      const accountName = newAccountName.trim();
      const accountSlug = newAccountSlug.trim() || slugify(accountName);
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
        message: `"${result.accountName || accountName}" wurde erstellt und der erste Admin eingeladen.`
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

  // --- Edit modal lifecycle ---
  const closeEditDialog = () => {
    setEditAccount(null);
    setEditName('');
    setEditSlug('');
    setEditStatus('ACTIVE');
    setEditReason('');
    setShowDiscardConfirm(false);
    setShowArchiveConfirm(false);
    setShowReactivateConfirm(false);
    setShowDeleteStep(false);
    setDeleteSlugInput('');
    setDeleteReason('');
    setDeleteDryRun(null);
    setPendingTrialAction(null);
    setTrialActionReason('');
  };

  const tryCloseEditDialog = () => {
    if (isDirtyRef.current) {
      setShowDiscardConfirm(true);
    } else {
      closeEditDialog();
    }
  };

  const openEditDialog = (account: PlatformAccount) => {
    const effectiveStatus: 'ACTIVE' | 'SUSPENDED' = account.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    setEditAccount(account);
    setEditName(account.name || '');
    setEditSlug(account.slug || '');
    setEditStatus(effectiveStatus);
    setEditReason('');
    setShowDiscardConfirm(false);
    setShowArchiveConfirm(false);
    setShowReactivateConfirm(false);
    setShowDeleteStep(false);
    setDeleteSlugInput('');
    setDeleteReason('');
    setDeleteDryRun(null);
    setPendingTrialAction(null);
    setTrialActionReason('');
  };

  // --- Save name / slug / status ---
  const handleSaveEdit = async () => {
    if (!editAccount || !isDirty) return;
    const nextName = editName.trim();
    const nextSlug = slugify(editSlug);
    if (!nextName || !nextSlug) {
      pushToast({ type: 'error', title: 'Ungültige Eingabe', message: 'Name und Slug sind erforderlich.' });
      return;
    }

    const payload: { name?: string; slug?: string; status?: PlatformAccountStatus; reason?: string } = {};
    if (nextName !== editAccount.name) payload.name = nextName;
    if (nextSlug !== editAccount.slug) payload.slug = nextSlug;
    const originalStatus: 'ACTIVE' | 'SUSPENDED' = editAccount.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    if (editAccount.status !== 'ARCHIVED' && editStatus !== originalStatus) {
      payload.status = editStatus;
    }
    if (editReason.trim()) payload.reason = editReason.trim();

    setIsSavingEdit(true);
    try {
      const result = await PlatformAdminApi.updateAccount(editAccount.id, payload);
      if (result.account) {
        setEditAccount(prev => prev ? { ...prev, ...result.account } : prev);
        setEditName(result.account.name || nextName);
        setEditSlug(result.account.slug || nextSlug);
        const savedStatus: 'ACTIVE' | 'SUSPENDED' = result.account.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
        setEditStatus(savedStatus);
      }
      setEditReason('');
      pushToast({ type: 'success', title: 'Firma aktualisiert', message: `"${nextName}" wurde gespeichert.` });
      loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Speichern fehlgeschlagen',
        message: toActionErrorMessage(error, 'Änderungen konnten nicht gespeichert werden.')
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // --- Archive ---
  const handleArchive = async () => {
    if (!editAccount) return;
    setShowArchiveConfirm(false);
    setIsArchiving(true);
    try {
      const result = await PlatformAdminApi.updateAccount(editAccount.id, { status: 'ARCHIVED' });
      if (result.account) {
        setEditAccount(prev => prev ? { ...prev, ...result.account } : prev);
      }
      pushToast({ type: 'success', title: 'Archiviert', message: `"${editAccount.name}" wurde archiviert.` });
      loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Archivieren fehlgeschlagen',
        message: toActionErrorMessage(error, 'Account konnte nicht archiviert werden.')
      });
    } finally {
      setIsArchiving(false);
    }
  };

  // --- Reactivate (un-archive) ---
  const handleReactivate = async () => {
    if (!editAccount) return;
    setShowReactivateConfirm(false);
    setIsArchiving(true);
    try {
      const result = await PlatformAdminApi.updateAccount(editAccount.id, { status: 'ACTIVE' });
      if (result.account) {
        setEditAccount(prev => prev ? { ...prev, ...result.account } : prev);
        setEditStatus('ACTIVE');
      }
      pushToast({ type: 'success', title: 'Reaktiviert', message: `"${editAccount.name}" wurde reaktiviert.` });
      loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Reaktivierung fehlgeschlagen',
        message: toActionErrorMessage(error, 'Account konnte nicht reaktiviert werden.')
      });
    } finally {
      setIsArchiving(false);
    }
  };

  // --- Trial action ---
  const handleTrialAction = async () => {
    if (!editAccount || !pendingTrialAction) return;
    setIsUpdatingTrial(true);
    try {
      const result = await PlatformAdminApi.updateAccountTrial(
        editAccount.id,
        pendingTrialAction,
        trialActionReason.trim() || undefined
      );
      if (result.account) {
        setEditAccount(prev => prev ? { ...prev, ...result.account } : prev);
      }
      const actionText = pendingTrialAction === 'EXTEND_14_DAYS' ? 'um 14 Tage verlängert' : 'beendet';
      pushToast({ type: 'success', title: 'Testphase aktualisiert', message: `Testphase wurde ${actionText}.` });
      setPendingTrialAction(null);
      setTrialActionReason('');
      loadOwnerOverview();
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Aktion fehlgeschlagen',
        message: toActionErrorMessage(error, 'Testphase konnte nicht aktualisiert werden.')
      });
    } finally {
      setIsUpdatingTrial(false);
    }
  };

  // --- Delete step ---
  const handleShowDeleteStep = async () => {
    if (!editAccount) return;
    setShowDeleteStep(true);
    setDeleteSlugInput('');
    setDeleteReason('');
    setDeleteDryRun(null);
    setIsRunningDeleteDryRun(true);
    try {
      const dryRun = await PlatformAdminApi.deleteAccountDryRun(editAccount.id);
      setDeleteDryRun(dryRun.counts || null);
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

  const handleDeleteHard = async () => {
    if (!editAccount) return;
    setIsDeletingAccount(true);
    try {
      await PlatformAdminApi.deleteAccountHard(
        editAccount.id,
        deleteSlugInput.trim(),
        deleteReason.trim() || undefined
      );
      pushToast({
        type: 'success',
        title: 'Firma gelöscht',
        message: `"${editAccount.name}" wurde vollständig gelöscht.`
      });
      closeEditDialog();
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

  const isAnyActionBusy = isSavingEdit || isArchiving || isUpdatingTrial || isDeletingAccount;

  return (
    <div className="min-h-screen flex flex-col">

      {/* Unsaved changes guard */}
      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title="Änderungen verwerfen?"
        message="Es gibt ungespeicherte Änderungen. Sollen diese verworfen werden?"
        confirmText="Verwerfen"
        cancelText="Weiter bearbeiten"
        type="warning"
        onConfirm={closeEditDialog}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      {/* Archive confirm */}
      <ConfirmDialog
        isOpen={showArchiveConfirm}
        title="Account archivieren"
        message={editAccount
          ? `Soll "${editAccount.name}" archiviert werden? Benutzer verlieren den Zugriff, Daten bleiben erhalten.`
          : ''}
        confirmText="Archivieren"
        cancelText="Abbrechen"
        type="warning"
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />

      {/* Reactivate confirm */}
      <ConfirmDialog
        isOpen={showReactivateConfirm}
        title="Account reaktivieren"
        message={editAccount ? `Soll "${editAccount.name}" reaktiviert werden (Status: ACTIVE)?` : ''}
        confirmText="Reaktivieren"
        cancelText="Abbrechen"
        type="warning"
        onConfirm={handleReactivate}
        onCancel={() => setShowReactivateConfirm(false)}
      />

      {/* ===== Unified Edit Modal ===== */}
      {editAccount && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) tryCloseEditDialog(); }}
        >
          <div className="relative z-[2001] bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {showDeleteStep ? 'Firma endgültig löschen' : 'Firma bearbeiten'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">{editAccount.name} · {editAccount.id}</p>
              </div>
              <button
                onClick={tryCloseEditDialog}
                disabled={isAnyActionBusy}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-40 ml-4 mt-0.5 shrink-0"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!showDeleteStep ? (
                <>
                  {/* === Firmendaten === */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-slate-700">Firmendaten</h4>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Firmenname</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                        placeholder="Firmenname"
                        disabled={isAnyActionBusy}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Slug</label>
                      <input
                        type="text"
                        value={editSlug}
                        onChange={e => setEditSlug(slugify(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                        placeholder="firmen-slug"
                        disabled={isAnyActionBusy}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
                      {editAccount.status === 'ARCHIVED' ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-slate-200 text-slate-700">ARCHIVED</span>
                          <span className="text-xs text-slate-400">(über „Reaktivieren" ändern)</span>
                        </div>
                      ) : (
                        <select
                          value={editStatus}
                          onChange={e => setEditStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}
                          className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                          disabled={isAnyActionBusy}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Grund (optional)</label>
                      <input
                        type="text"
                        value={editReason}
                        onChange={e => setEditReason(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                        placeholder="z. B. Stammdaten-Korrektur"
                        disabled={isAnyActionBusy}
                      />
                    </div>
                  </div>

                  {/* === Testphase === */}
                  {editAccount.trial_state && (
                    <div className="space-y-3 border-t border-slate-200 pt-5">
                      <h4 className="text-sm font-semibold text-slate-700">Testphase</h4>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${trialBadgeClass(editAccount.trial_state)}`}>
                          {editAccount.trial_state}
                        </span>
                        {editAccount.trial_ends_at && (
                          <span className="text-xs text-slate-500">
                            Bis: {formatDate(editAccount.trial_ends_at)}
                          </span>
                        )}
                        {editAccount.trial_state === 'TRIAL_ACTIVE' && editAccount.trial_ends_at && (
                          <span className="text-xs text-blue-600 font-medium">
                            Noch {trialDaysRemaining(editAccount.trial_ends_at)} Tage
                          </span>
                        )}
                      </div>

                      {pendingTrialAction ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                          <p className="text-sm font-medium text-slate-700">
                            {pendingTrialAction === 'EXTEND_14_DAYS'
                              ? 'Testphase um 14 Tage verlängern bestätigen:'
                              : 'Testphase sofort beenden (→ SUBSCRIBED) bestätigen:'}
                          </p>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Grund (optional)</label>
                            <input
                              type="text"
                              value={trialActionReason}
                              onChange={e => setTrialActionReason(e.target.value)}
                              className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                              placeholder="z. B. Verlängerung genehmigt"
                              disabled={isUpdatingTrial}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setPendingTrialAction(null); setTrialActionReason(''); }}
                              disabled={isUpdatingTrial}
                              className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              Abbrechen
                            </button>
                            <button
                              onClick={handleTrialAction}
                              disabled={isUpdatingTrial}
                              className={`px-3 py-1.5 text-xs rounded text-white font-semibold disabled:opacity-40 ${pendingTrialAction === 'EXTEND_14_DAYS' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900'}`}
                            >
                              {isUpdatingTrial ? 'Wird gespeichert...' : 'Bestätigen'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setPendingTrialAction('EXTEND_14_DAYS')}
                            disabled={editAccount.status === 'ARCHIVED' || isAnyActionBusy}
                            className="px-3 py-1.5 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            +14 Tage
                          </button>
                          <button
                            onClick={() => setPendingTrialAction('CANCEL_TRIAL')}
                            disabled={editAccount.trial_state === 'SUBSCRIBED' || isAnyActionBusy}
                            className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Testphase beenden
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* === Gefahrenbereich === */}
                  <div className="space-y-3 border-t border-red-100 pt-5">
                    <h4 className="text-sm font-semibold text-red-700">Gefahrenbereich</h4>
                    <div className="flex flex-wrap gap-2">
                      {editAccount.status === 'ARCHIVED' ? (
                        <button
                          onClick={() => setShowReactivateConfirm(true)}
                          disabled={isAnyActionBusy}
                          className="px-3 py-1.5 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                        >
                          Reaktivieren
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowArchiveConfirm(true)}
                          disabled={isAnyActionBusy}
                          className="px-3 py-1.5 text-xs rounded border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                        >
                          Archivieren
                        </button>
                      )}
                      <button
                        onClick={handleShowDeleteStep}
                        disabled={isAnyActionBusy}
                        className="px-3 py-1.5 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Firma löschen
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* === Delete Step === */
                <div className="space-y-4">
                  <button
                    onClick={() => setShowDeleteStep(false)}
                    disabled={isDeletingAccount}
                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 disabled:opacity-40"
                  >
                    ← Zurück
                  </button>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-700 mb-1">Unwiderrufliche Aktion</p>
                    <p className="text-sm text-red-600">
                      Alle Daten von <strong>{editAccount.name}</strong> werden permanent gelöscht.
                      Diese Aktion kann nicht rückgängig gemacht werden.
                    </p>
                  </div>

                  {isRunningDeleteDryRun ? (
                    <p className="text-sm text-slate-500">Dry-Run wird geladen...</p>
                  ) : (
                    <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="font-semibold mb-2">Betroffene Datensätze:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                        <p>Routen: {deleteDryRun?.routes ?? 0}</p>
                        <p>Halte: {deleteDryRun?.stops ?? 0}</p>
                        <p>Kunden: {deleteDryRun?.customers ?? 0}</p>
                        <p>Kontakte: {deleteDryRun?.contacts ?? 0}</p>
                        <p>Mitarbeiter: {deleteDryRun?.workers ?? 0}</p>
                        <p>Bustypen: {deleteDryRun?.busTypes ?? 0}</p>
                        <p>App Settings: {deleteDryRun?.appSettings ?? 0}</p>
                        <p>Memberships: {deleteDryRun?.memberships ?? 0}</p>
                        <p>Einladungen: {deleteDryRun?.invitations ?? 0}</p>
                        <p>Betroffene User: {deleteDryRun?.users ?? 0}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Zur Bestätigung Slug eingeben:{' '}
                      <span className="text-slate-900 font-mono">{editAccount.slug}</span>
                    </label>
                    <input
                      type="text"
                      value={deleteSlugInput}
                      onChange={e => setDeleteSlugInput(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                      placeholder="Slug eingeben"
                      disabled={isDeletingAccount}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Grund (optional)</label>
                    <input
                      type="text"
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                      placeholder="z. B. Testaccount-Bereinigung"
                      disabled={isDeletingAccount}
                    />
                  </div>

                  <button
                    onClick={handleDeleteHard}
                    disabled={isDeletingAccount || deleteSlugInput.trim() !== editAccount.slug}
                    className="w-full px-4 py-2.5 rounded-lg text-white font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeletingAccount ? 'Wird gelöscht...' : 'Firma endgültig löschen'}
                  </button>
                </div>
              )}
            </div>

            {/* Modal footer — only in edit mode, not delete step */}
            {!showDeleteStep && (
              <div className="flex justify-end gap-3 p-6 border-t border-slate-200 shrink-0">
                <button
                  onClick={tryCloseEditDialog}
                  disabled={isAnyActionBusy}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!isDirty || isSavingEdit}
                  className="px-4 py-2 rounded-lg text-white font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSavingEdit ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            )}
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
            {/* Create account form */}
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
                      if (!newAccountSlug.trim()) setNewAccountSlug(slugify(name));
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

            {/* Companies list */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-800">Owner Bereich: Firmen und User</h2>
              <div className="space-y-3">
                {accounts.map(account => {
                  const status = account.status || 'ACTIVE';
                  const members = accountMembersByAccountId[account.id] || [];
                  const isExpanded = !!expandedAccountIds[account.id];

                  return (
                    <div key={account.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        {/* Expand / name */}
                        <button
                          onClick={() => toggleAccountExpanded(account.id)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4 shrink-0" />
                              : <ChevronRight className="w-4 h-4 shrink-0" />}
                            <span className="truncate">{account.name}</span>
                          </p>
                          <p className="text-xs text-slate-500 truncate pl-5">
                            {account.slug} · Erstellt: {formatDateTime(account.created_at)}
                          </p>
                        </button>

                        {/* Badges + user count + edit button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`hidden sm:inline-flex px-2 py-1 rounded text-xs font-semibold ${statusBadgeClass(status)}`}>
                            {status}
                          </span>
                          {account.trial_state && (
                            <span className={`hidden sm:inline-flex px-2 py-1 rounded text-xs font-semibold ${trialBadgeClass(account.trial_state)}`}>
                              {account.trial_state}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">{members.length} User</span>
                          <button
                            onClick={() => openEditDialog(account)}
                            className="px-3 py-1.5 text-xs rounded bg-slate-900 text-white hover:bg-slate-700 font-semibold"
                          >
                            Bearbeiten
                          </button>
                        </div>
                      </div>

                      {/* Expanded members list */}
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
                {accounts.length === 0 && (
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
