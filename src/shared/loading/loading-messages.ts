import type { LoadingMessageKey, LoadingScope } from './loading-types';

export const LOADING_DEFAULT_MESSAGE = 'Lade...';

const SCOPED_LOADING_MESSAGES: Record<LoadingScope, Record<LoadingMessageKey, string>> = {
  route: {
    'route.transition': 'Lade...',
    'route.bootstrap': 'Lade...'
  },
  auth: {
    'auth.bootstrap': 'Lade...',
    'auth.session': 'Lade...'
  },
  action: {
    'action.save': 'Speichere...',
    'action.delete': 'Loesche...',
    'action.import': 'Importiere...',
    'action.profile.avatar.save': 'Speichere Profilbild...',
    'action.profile.email.change': 'Aendere E-Mail...',
    'action.profile.password.reset': 'Sende Passwort-Reset...',
    'action.team.invite.send': 'Sende Einladung...',
    'action.team.membership.update': 'Aktualisiere Rolle...',
    'action.team.user.delete': 'Loesche Benutzer...',
    'action.team.invitation.delete': 'Loesche Einladung...',
    'action.team.invitation.resend': 'Sende Einladung erneut...',
    'action.owner.account.create': 'Lege Firma an...',
    'action.owner.account.save': 'Speichere Firmendaten...',
    'action.owner.account.archive': 'Archiviere Firma...',
    'action.owner.account.reactivate': 'Reaktiviere Firma...',
    'action.owner.trial.update': 'Aktualisiere Testphase...',
    'action.owner.account.delete': 'Loesche Firma...',
    'action.owner.account.delete.dry_run': 'Pruefe Loeschumfang...',
    'action.busflow.route.save': 'Speichere Route...',
    'action.busflow.route.delete': 'Loesche Route...',
    'action.busflow.bus_type.save': 'Speichere Bustyp...',
    'action.busflow.bus_type.delete': 'Loesche Bustyp...',
    'action.busflow.worker.save': 'Speichere Mitarbeiter...',
    'action.busflow.worker.delete': 'Loesche Mitarbeiter...',
    'action.busflow.contact.save': 'Speichere Kontakt...',
    'action.busflow.contact.delete': 'Loesche Kontakt...',
    'action.busflow.customer.import.preview': 'Pruefe CSV...',
    'action.busflow.customer.import.commit': 'Importiere Kontakte...',
    'action.busflow.customer.bulk_delete': 'Loesche Kontakte...',
    'action.busflow.map_default.save': 'Speichere Karten-Standard...'
  },
  system: {
    'system.default': 'Lade...'
  }
};

export interface ResolveLoadingMessageInput {
  scope: LoadingScope;
  message?: string;
  messageKey?: LoadingMessageKey;
  fallback?: string;
}

export const resolveScopedLoadingMessage = (scope: LoadingScope, messageKey?: LoadingMessageKey): string | null => {
  if (!messageKey) {
    return null;
  }
  const scopedMap = SCOPED_LOADING_MESSAGES[scope];
  const resolved = scopedMap?.[messageKey];
  return resolved?.trim() || null;
};

export const resolveLoadingMessage = ({
  scope,
  message,
  messageKey,
  fallback = LOADING_DEFAULT_MESSAGE
}: ResolveLoadingMessageInput): string => {
  const explicitMessage = message?.trim();
  if (explicitMessage) {
    return explicitMessage;
  }

  const scoped = resolveScopedLoadingMessage(scope, messageKey);
  if (scoped) {
    return scoped;
  }

  return fallback.trim() || LOADING_DEFAULT_MESSAGE;
};

export const loadingMessageRegistry = SCOPED_LOADING_MESSAGES;
