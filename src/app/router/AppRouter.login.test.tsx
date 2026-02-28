import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppRouter from './AppRouter';
import { LoadingProvider } from '../../shared/loading';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSignInWithPassword = vi.fn();
const mockResetPasswordForEmail = vi.fn();

vi.mock('../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

const mockUseAuth = vi.fn();
vi.mock('../../shared/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockPushToast = vi.fn();
vi.mock('../../shared/components/ToastProvider', () => ({
  useToast: () => ({ pushToast: mockPushToast }),
}));

// AuthCallbackNormalizer reads hash — mock it away
vi.mock('./AuthCallbackNormalizer', () => ({
  default: () => null,
}));

// AuthShaderBackground requires WebGL which jsdom doesn't support
vi.mock('../../shared/components/auth/AuthShaderBackground', () => ({
  default: () => null,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const unauthenticatedState = {
  user: null,
  activeAccountId: null,
  activeAccount: null,
  canManageTenantUsers: false,
  loading: false,
  logout: vi.fn(),
};

/** The labels in LoginScreen are not associated via htmlFor/id,
 *  so we query inputs by placeholder text. */
const getEmailInput = () => screen.getByPlaceholderText('name@firma.de');
const getPasswordInput = () => screen.getByPlaceholderText(/•{3,}/);
const getForm = () => screen.getByRole('button', { name: /anmeld/i }).closest('form')!;

function renderRouter(initialPath = '/') {
  return render(
    <LoadingProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRouter />
      </MemoryRouter>
    </LoadingProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Login-Bildschirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(unauthenticatedState);
  });

  it('zeigt das Login-Formular für nicht angemeldete Nutzer', () => {
    renderRouter();

    expect(screen.getByText('Anmeldung')).toBeInTheDocument();
    expect(getEmailInput()).toBeInTheDocument();
    expect(getPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anmelden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /passwort vergessen/i })).toBeInTheDocument();
  });

  it('rendert den Link zur Registrierung', () => {
    renderRouter();
    expect(screen.getByRole('link', { name: /jetzt registrieren/i })).toBeInTheDocument();
  });
});

describe('Login-Formular – Eingabe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(unauthenticatedState);
  });

  it('aktualisiert E-Mail- und Passwort-Felder bei Eingabe', async () => {
    renderRouter();

    await userEvent.type(getEmailInput(), 'test@example.de');
    await userEvent.type(getPasswordInput(), 'geheim123');

    expect(getEmailInput()).toHaveValue('test@example.de');
    expect(getPasswordInput()).toHaveValue('geheim123');
  });
});

describe('Login-Submit – Erfolg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(unauthenticatedState);
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  it('ruft supabase.auth.signInWithPassword mit den Formulardaten auf', async () => {
    renderRouter();

    await userEvent.type(getEmailInput(), 'fahrer@busfleet.de');
    await userEvent.type(getPasswordInput(), 'sicher99');
    fireEvent.submit(getForm());

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'fahrer@busfleet.de',
        password: 'sicher99',
      });
    });
  });

  it('zeigt während des Ladens "Verarbeite..."', async () => {
    // Lasse den Promise hängen, um den Ladezustand zu prüfen
    let resolve!: (v: unknown) => void;
    mockSignInWithPassword.mockReturnValue(new Promise(r => (resolve = r)));

    renderRouter();

    await userEvent.type(getEmailInput(), 'a@b.de');
    await userEvent.type(getPasswordInput(), 'passwort');
    fireEvent.submit(getForm());

    expect(await screen.findByText('Verarbeite...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verarbeite/i })).toBeDisabled();

    // Auflösen, damit keine offenen Promises zurückbleiben
    resolve({ error: null });
  });
});

describe('Login-Submit – Fehler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(unauthenticatedState);
  });

  it('zeigt eine Fehlermeldung bei ungültigen Zugangsdaten', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: new Error('Invalid login credentials'),
    });

    renderRouter();

    await userEvent.type(getEmailInput(), 'falsch@example.de');
    await userEvent.type(getPasswordInput(), 'falsch');
    fireEvent.submit(getForm());

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  });

  it('zeigt Fallback-Meldung, wenn kein Error-Text vorhanden', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: {} }); // kein message-Feld

    renderRouter();

    await userEvent.type(getEmailInput(), 'x@x.de');
    await userEvent.type(getPasswordInput(), 'xxxxxx');
    fireEvent.submit(getForm());

    expect(await screen.findByText('Anmeldung fehlgeschlagen.')).toBeInTheDocument();
  });

  it('setzt Fehlermeldung beim nächsten Versuch zurück', async () => {
    mockSignInWithPassword
      .mockResolvedValueOnce({ error: new Error('Erster Fehler') })
      .mockResolvedValueOnce({ error: null });

    renderRouter();

    await userEvent.type(getEmailInput(), 'a@b.de');
    await userEvent.type(getPasswordInput(), 'pass123');
    fireEvent.submit(getForm());

    expect(await screen.findByText('Erster Fehler')).toBeInTheDocument();

    fireEvent.submit(getForm());

    await waitFor(() => {
      expect(screen.queryByText('Erster Fehler')).not.toBeInTheDocument();
    });
  });
});

describe('Passwort vergessen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(unauthenticatedState);
    mockResetPasswordForEmail.mockResolvedValue({});
  });

  it('zeigt Fehler, wenn kein E-Mail-Feld ausgefüllt ist', async () => {
    renderRouter();

    await userEvent.click(screen.getByRole('button', { name: /passwort vergessen/i }));

    expect(await screen.findByText(/bitte zuerst ihre e-mail/i)).toBeInTheDocument();
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('ruft resetPasswordForEmail mit der eingegebenen E-Mail auf', async () => {
    renderRouter();

    await userEvent.type(getEmailInput(), 'reset@busfleet.de');
    await userEvent.click(screen.getByRole('button', { name: /passwort vergessen/i }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'reset@busfleet.de',
        expect.objectContaining({ redirectTo: expect.any(String) }),
      );
    });
  });

  it('zeigt neutrale Bestätigungsmeldung nach dem Absenden', async () => {
    renderRouter();

    await userEvent.type(getEmailInput(), 'irgendwer@busfleet.de');
    await userEvent.click(screen.getByRole('button', { name: /passwort vergessen/i }));

    expect(
      await screen.findByText(/wenn ein passendes konto existiert/i),
    ).toBeInTheDocument();
  });
});
