import { describe, expect, it } from 'vitest';
import { LOADING_DEFAULT_MESSAGE, resolveLoadingMessage, resolveScopedLoadingMessage } from './loading-messages';

describe('loading message resolver', () => {
  it('prefers explicit message over keyed or fallback values', () => {
    const result = resolveLoadingMessage({
      scope: 'action',
      message: 'Benutzerdefiniert...',
      messageKey: 'action.save'
    });

    expect(result).toBe('Benutzerdefiniert...');
  });

  it('resolves scoped key when explicit message is missing', () => {
    expect(resolveScopedLoadingMessage('action', 'action.save')).toBe('Speichere...');
    expect(
      resolveLoadingMessage({
        scope: 'action',
        messageKey: 'action.save'
      })
    ).toBe('Speichere...');
  });

  it('resolves known domain specific action keys', () => {
    const knownActionKeys = [
      ['action.profile.email.change', 'Aendere E-Mail...'],
      ['action.profile.password.reset', 'Sende Passwort-Reset...'],
      ['action.team.invite.send', 'Sende Einladung...'],
      ['action.team.invitation.resend', 'Sende Einladung erneut...'],
      ['action.owner.account.create', 'Lege Firma an...'],
      ['action.owner.trial.update', 'Aktualisiere Testphase...'],
      ['action.busflow.route.save', 'Speichere Route...'],
      ['action.busflow.customer.import.commit', 'Importiere Kontakte...']
    ] as const;

    for (const [key, expected] of knownActionKeys) {
      expect(resolveScopedLoadingMessage('action', key)).toBe(expected);
      expect(
        resolveLoadingMessage({
          scope: 'action',
          messageKey: key
        })
      ).toBe(expected);
    }
  });

  it('falls back to Lade... for unknown keys or blank values', () => {
    expect(resolveScopedLoadingMessage('auth', 'auth.unknown')).toBeNull();
    expect(resolveScopedLoadingMessage('action', 'action.unknown')).toBeNull();
    expect(
      resolveLoadingMessage({
        scope: 'auth',
        message: '   ',
        messageKey: 'auth.unknown'
      })
    ).toBe(LOADING_DEFAULT_MESSAGE);
  });
});
