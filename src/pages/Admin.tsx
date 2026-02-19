import React, { useEffect, useState } from 'react';
import { supabase } from '../shared/lib/supabase';
import AppHeader from '../shared/components/AppHeader';
import { Leaf } from 'lucide-react';
import { useToast } from '../shared/components/ToastProvider';
import ConfirmDialog from '../shared/components/ConfirmDialog';

interface AppCard {
  id: string;
  title: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  global_role: 'ADMIN' | 'USER';
}

interface AppPermission {
  user_id: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
}

interface AdminUser extends Profile {
  busflow_role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
}

interface Props {
  // We don't need passed props for users anymore, fetching inside.
  apps: AppCard[];
  currentUserId?: string;
  header: {
    title: string;
    user: any;
    onHome: () => void;
    onProfile: () => void;
    onAdmin: () => void;
    onLogout: () => void;
  };
  // Keeping these for interface compatibility with App.tsx but they will be ignored/optional
  users?: any;
  newUserName?: any;
  newUserPassword?: any;
  newUserRole?: any;
  onNewUserName?: any;
  onNewUserPassword?: any;
  onNewUserRole?: any;
  onAddUser?: any;
  onRemoveUser?: any;
  onUpdateUser?: any;
}

const Admin: React.FC<Props> = ({ apps, currentUserId, header }) => {
  const { pushToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userIdToDelete, setUserIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const [profilesRes, permissionsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('app_permissions')
        .select('user_id, role')
        .eq('app_id', 'busflow')
    ]);

    if (profilesRes.error) {
      console.error('Error fetching profiles:', profilesRes.error);
      setLoading(false);
      return;
    }

    if (permissionsRes.error) {
      console.error('Error fetching app permissions:', permissionsRes.error);
      setLoading(false);
      return;
    }

    const permissionByUser = new Map<string, AppPermission['role']>();
    (permissionsRes.data as AppPermission[]).forEach((permission) => {
      permissionByUser.set(permission.user_id, permission.role);
    });

    const mergedUsers: AdminUser[] = (profilesRes.data as Profile[]).map((profile) => ({
      ...profile,
      busflow_role: permissionByUser.get(profile.id) || 'DISPATCH'
    }));

    setUsers(mergedUsers);
    setLoading(false);
  };

  const handleUpdateGlobalRole = async (userId: string, newRole: 'ADMIN' | 'USER') => {
    if (currentUserId === userId) return;

    const { error } = await supabase
      .from('profiles')
      .update({ global_role: newRole })
      .eq('id', userId);

    if (error) {
      pushToast({
        type: 'error',
        title: 'Aktualisierung fehlgeschlagen',
        message: `Fehler beim Aktualisieren der Plattformrolle: ${error.message}`
      });
    } else {
      pushToast({
        type: 'success',
        title: 'Gespeichert',
        message: 'Plattformrolle wurde aktualisiert.'
      });
      fetchProfiles();
    }
  };

  const handleUpdateBusflowRole = async (userId: string, newRole: 'ADMIN' | 'DISPATCH' | 'VIEWER') => {
    const { error } = await supabase
      .from('app_permissions')
      .upsert(
        {
          user_id: userId,
          app_id: 'busflow',
          role: newRole
        },
        { onConflict: 'user_id,app_id' }
      );

    if (error) {
      pushToast({
        type: 'error',
        title: 'Aktualisierung fehlgeschlagen',
        message: `Fehler beim Aktualisieren der BusFlow-Rolle: ${error.message}`
      });
    } else {
      pushToast({
        type: 'success',
        title: 'Gespeichert',
        message: 'BusFlow-Rolle wurde aktualisiert.'
      });
      fetchProfiles();
    }
  };

  // Note: Deleting a user from 'profiles' does not delete them from 'auth.users' without a trigger/function.
  // For now, we will just delete the profile which effectively hides them from the app logic (if specific checks exist).
  const handleDeleteProfile = async () => {
    if (!userIdToDelete) return;
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userIdToDelete);

    if (error) {
      pushToast({
        type: 'error',
        title: 'Entfernen fehlgeschlagen',
        message: `Fehler beim Entfernen: ${error.message}`
      });
    } else {
      pushToast({
        type: 'success',
        title: 'Entfernt',
        message: 'Benutzerzugriff wurde entzogen.'
      });
      fetchProfiles();
    }
    setUserIdToDelete(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ConfirmDialog
        isOpen={!!userIdToDelete}
        title="Benutzer entfernen"
        message="Diesen Benutzer wirklich entfernen? Das Auth-Konto bleibt bestehen, aber der Zugriff wird entzogen."
        confirmText="Entfernen"
        cancelText="Abbrechen"
        type="danger"
        onConfirm={handleDeleteProfile}
        onCancel={() => setUserIdToDelete(null)}
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

        {/* Invite Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">Benutzer einladen</h2>
          <p className="text-sm text-slate-500 mt-2">
            Neue Benutzer können sich selbst über die Startseite registrieren.
            Nach der Registrierung erscheinen sie hier und Sie können ihnen die Rolle <strong>ADMIN</strong> zuweisen, falls nötig.
          </p>
        </div>

        {/* User List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Bestehende Benutzer</h3>
            <button
              onClick={fetchProfiles}
              className="text-sm text-blue-600 hover:underline"
            >
              Aktualisieren
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Leaf className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {users.map(profile => (
                <div key={profile.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center border border-slate-200 rounded-lg p-4">
                  <div className="md:col-span-1">
                    <p className="text-sm font-bold text-slate-900">{profile.full_name || 'Kein Name'}</p>
                    <p className="text-xs text-slate-500">{profile.email}</p>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Plattformrolle</label>
                    <select
                      value={profile.global_role || 'USER'}
                      onChange={(e) => handleUpdateGlobalRole(profile.id, e.target.value as 'ADMIN' | 'USER')}
                      className="w-full border-slate-300 rounded-lg p-2 text-sm"
                      disabled={currentUserId === profile.id}
                    >
                      <option value="USER">Benutzer</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">BusFlow-Rolle</label>
                    <select
                      value={profile.busflow_role}
                      onChange={(e) => handleUpdateBusflowRole(profile.id, e.target.value as 'ADMIN' | 'DISPATCH' | 'VIEWER')}
                      className="w-full border-slate-300 rounded-lg p-2 text-sm"
                    >
                      <option value="VIEWER">Nur Lesen</option>
                      <option value="DISPATCH">Bearbeiten</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <div className="md:col-span-1 flex justify-end">
                    <button
                      onClick={() => setUserIdToDelete(profile.id)}
                      disabled={currentUserId === profile.id}
                      className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${currentUserId === profile.id
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-red-600 hover:bg-red-50'
                        }`}
                    >
                      Zugriff entziehen
                    </button>
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <p className="text-center text-slate-500 py-4">Keine Benutzer gefunden.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Admin;
