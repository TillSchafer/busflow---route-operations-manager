import React from 'react';
import AppHeader from '../shared/components/AppHeader';

interface AppCard {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  onMouseEnter?: () => void;
}

interface User {
  name: string;
  role: 'ADMIN' | 'DISPATCH' | 'VIEWER';
  avatarUrl?: string;
  isPlatformOwner?: boolean;
}

interface Props {
  apps: AppCard[];
  auth: User | null;
  activeAccount?: {
    trialState?: 'TRIAL_ACTIVE' | 'TRIAL_ENDED' | 'SUBSCRIBED';
    trialEndsAt?: string;
  } | null;
  onProfile: () => void;
  onAdmin: () => void;
  onOwner?: () => void;
  onLogout: () => void;
  onHome: () => void;
}

const Home: React.FC<Props> = ({ apps, auth, activeAccount, onProfile, onAdmin, onOwner, onLogout, onHome }) => {
  const showTrialNotice = activeAccount?.trialState === 'TRIAL_ACTIVE' && !!activeAccount.trialEndsAt;
  const trialEndDate = showTrialNotice
    ? new Date(activeAccount.trialEndsAt as string).toLocaleDateString('de-DE')
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        title="Startseite"
        user={auth}
        onHome={onHome}
        onProfile={onProfile}
        onAdmin={onAdmin}
        onOwner={onOwner}
        onLogout={onLogout}
      />
      <main className="flex-1 p-4 md:p-8 no-print max-w-7xl mx-auto w-full flex flex-col items-center justify-center">
        {showTrialNotice && (
          <div className="w-full max-w-5xl mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Testphase aktiv bis <span className="font-semibold">{trialEndDate}</span>. Ihr Zugang bleibt aktuell nutzbar.
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">
            Willkommen bei Schäfer
          </h1>
          <p className="text-slate-500 mt-3">Wählen Sie eine Anwendung aus.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-5xl mx-auto">
          {apps.map(app => {
            const Icon = app.icon;
            return (
              <button
                key={app.id}
                onClick={app.onClick}
                onMouseEnter={app.onMouseEnter}
                className="group text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow w-full max-w-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    Aktiv
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">{app.title}</h2>
                <p className="text-sm text-slate-500 mt-2">{app.description}</p>
              </button>
            );
          })}
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-slate-400 flex flex-col justify-between w-full max-w-sm">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Demnächst</p>
              <h2 className="text-lg font-semibold mt-2">Neue App hinzufügen</h2>
            </div>
            <p className="text-sm mt-6">Hier erscheinen zukünftige Tools.</p>
          </div>
          {['Company GPT', 'KFZ', 'Fahrtenrechner', 'Intranet'].map(service => (
            <div
              key={service}
              className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-slate-400 flex flex-col justify-between w-full max-w-sm"
            >
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">In Arbeit</p>
                <h2 className="text-lg font-semibold mt-2">{service}</h2>
              </div>
              <p className="text-sm mt-6">Dieser Service wird bald verfügbar sein.</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;
