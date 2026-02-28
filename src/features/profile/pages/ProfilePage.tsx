import React from 'react';
import AppHeader from '../../../shared/components/AppHeader';
import BackToOverviewButton from '../../../shared/components/BackToOverviewButton';
import FormField from '../../../shared/ui/form/FormField';
import TextInput from '../../../shared/ui/form/TextInput';
import ActionButton from '../../../shared/ui/form/ActionButton';

interface Props {
  name: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  avatarUrl?: string;
  isPlatformOwner?: boolean;
  email: string;
  profileAvatarUrl: string;
  profileEmail: string;
  onEmailChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onRequestEmailChange: () => void;
  onRequestPasswordReset: () => void;
  onSaveAvatar: () => void;
  canRequestEmailChange?: boolean;
  isEmailSubmitting?: boolean;
  isPasswordSubmitting?: boolean;
  isAvatarSubmitting?: boolean;
  onGoHome: () => void;
  onLogout: () => void;
  onProfile: () => void;
  onAdmin: () => void;
  onOwner?: () => void;
}

const Profile: React.FC<Props> = ({
  name,
  role,
  avatarUrl,
  isPlatformOwner,
  email,
  profileAvatarUrl,
  profileEmail,
  onEmailChange,
  onAvatarChange,
  onRequestEmailChange,
  onRequestPasswordReset,
  onSaveAvatar,
  canRequestEmailChange = false,
  isEmailSubmitting = false,
  isPasswordSubmitting = false,
  isAvatarSubmitting = false,
  onGoHome,
  onLogout,
  onProfile,
  onAdmin,
  onOwner
}) => {
  const initials = name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Mein Profil"
        user={{ name, role, avatarUrl, isPlatformOwner }}
        onHome={onGoHome}
        onProfile={onProfile}
        onAdmin={onAdmin}
        onOwner={onOwner}
        onLogout={onLogout}
      />
      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full">
        <div className="max-w-2xl space-y-6">
          <BackToOverviewButton onClick={onGoHome} />
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Mein Profil</h2>
              <p className="text-sm text-slate-500 mt-1">E-Mail, Passwort und Profilbild verwalten.</p>
            </div>

            {/* Identity */}
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center text-lg font-bold overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Angemeldet als</p>
                <p className="text-base font-bold text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">
                  {role === 'ADMIN' ? 'Admin' : role === 'DISPATCH' ? 'Disposition' : 'Nur Lesen'}
                </p>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Avatar URL */}
            <FormField label="Profilbild URL">
              <div className="flex flex-col sm:flex-row gap-2">
                <TextInput
                  type="url"
                  value={profileAvatarUrl}
                  onChange={e => onAvatarChange(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="https://..."
                  disabled={isAvatarSubmitting}
                />
                <ActionButton
                  type="button"
                  onClick={onSaveAvatar}
                  disabled={isAvatarSubmitting}
                  className="whitespace-nowrap text-sm"
                >
                  {isAvatarSubmitting ? 'Wird gespeichert...' : 'Profilbild speichern'}
                </ActionButton>
              </div>
            </FormField>

            <hr className="border-slate-100" />

            {/* Email */}
            <FormField
              label="E-Mail"
              hint="Nach Bestätigung beider E-Mails wird die Änderung aktiv."
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <TextInput
                  type="email"
                  value={profileEmail || email}
                  onChange={e => onEmailChange(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="name@firma.de"
                  disabled={isEmailSubmitting}
                />
                <ActionButton
                  type="button"
                  onClick={onRequestEmailChange}
                  disabled={!canRequestEmailChange || isEmailSubmitting}
                  variant="secondary"
                  className="whitespace-nowrap text-sm"
                >
                  {isEmailSubmitting ? 'Wird gesendet...' : 'E-Mail ändern'}
                </ActionButton>
              </div>
            </FormField>

            <hr className="border-slate-100" />

            {/* Password */}
            <FormField
              label="Passwort"
              hint="Sie erhalten einen Link per E-Mail und setzen das Passwort im Sicherheitsfenster."
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-400 text-sm select-none">
                  ••••••••
                </div>
                <ActionButton
                  type="button"
                  onClick={onRequestPasswordReset}
                  disabled={isPasswordSubmitting}
                  variant="outline"
                  className="whitespace-nowrap text-sm"
                >
                  {isPasswordSubmitting ? 'Wird gesendet...' : 'Passwort ändern'}
                </ActionButton>
              </div>
            </FormField>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
