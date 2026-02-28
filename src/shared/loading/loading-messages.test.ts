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

  it('falls back to Lade... for unknown keys or blank values', () => {
    expect(resolveScopedLoadingMessage('auth', 'auth.unknown')).toBeNull();
    expect(
      resolveLoadingMessage({
        scope: 'auth',
        message: '   ',
        messageKey: 'auth.unknown'
      })
    ).toBe(LOADING_DEFAULT_MESSAGE);
  });
});
