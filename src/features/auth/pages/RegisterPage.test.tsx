import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage';

const mockSignUp = vi.fn();
const mockSeedTrialRegistration = vi.fn();

vi.mock('../../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

vi.mock('../../../shared/api/public/registerTrial.api', () => ({
  PublicRegisterApi: {
    seedTrialRegistration: (...args: unknown[]) => mockSeedTrialRegistration(...args),
  },
  PublicRegisterError: class PublicRegisterError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock('../../../shared/components/auth/AuthShaderBackground', () => ({
  default: () => null,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );

const fillBasics = async (container: HTMLElement, password: string) => {
  await userEvent.type(screen.getByPlaceholderText('Max Mustermann'), 'Test User');
  await userEvent.type(screen.getByPlaceholderText('Muster Logistik GmbH'), 'Test Company');
  await userEvent.type(screen.getByPlaceholderText('name@firma.de'), 'USER@Example.com');

  const passwordFields = container.querySelectorAll('input[type="password"]');
  await userEvent.type(passwordFields[0], password);
  await userEvent.type(passwordFields[1], password);
};

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeedTrialRegistration.mockResolvedValue({ ok: true, code: 'REGISTRATION_CREATED' });
    mockSignUp.mockResolvedValue({ error: null });
  });

  it('blockt zu schwache Passwörter vor API-Aufrufen', async () => {
    const { container } = renderPage();
    await fillBasics(container, 'Password1');

    await userEvent.click(screen.getByRole('button', { name: /jetzt registrieren/i }));

    expect(
      await screen.findByText(
        'Das Passwort muss mindestens 12 Zeichen lang sein und Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.',
      ),
    ).toBeInTheDocument();
    expect(mockSeedTrialRegistration).not.toHaveBeenCalled();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('nutzt den lokalen Accept-Invite Redirect bei erfolgreicher Registrierung', async () => {
    const { container } = renderPage();
    await fillBasics(container, 'StrongPass123!');

    await userEvent.click(screen.getByRole('button', { name: /jetzt registrieren/i }));

    await waitFor(() => {
      expect(mockSeedTrialRegistration).toHaveBeenCalledWith({
        fullName: 'Test User',
        companyName: 'Test Company',
        email: 'user@example.com',
        honeypot: '',
      });
    });

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'StrongPass123!',
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining('/auth/accept-invite'),
        }),
      });
    });

    expect(
      await screen.findByText(/bitte prüfen sie ihr e-mail-postfach/i),
    ).toBeInTheDocument();
  });
});
