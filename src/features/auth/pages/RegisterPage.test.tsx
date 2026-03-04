import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RegisterPage from './RegisterPage';
import { PublicRegisterError } from '../../../shared/api/public/registerTrial.api';

const mockSeedTrialRegistration = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../shared/api/public/registerTrial.api', () => ({
  PublicRegisterApi: {
    seedTrialRegistration: (...args: unknown[]) => mockSeedTrialRegistration(...args),
  },
  PublicRegisterError: class PublicRegisterError extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.code = code;
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

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeedTrialRegistration.mockResolvedValue({ ok: true, code: 'REGISTRATION_SEEDED' });
  });

  it('zeigt das Formular an', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Max Mustermann')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Muster Logistik GmbH')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@firma.de')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /weiter/i })).toBeInTheDocument();
  });

  it('validiert leere Felder vor API-Aufruf', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /weiter/i }));
    expect(mockSeedTrialRegistration).not.toHaveBeenCalled();
  });

  it('navigiert nach erfolgreicher Registrierung zur Accept-Invite-Seite', async () => {
    renderPage();

    await userEvent.type(screen.getByPlaceholderText('Max Mustermann'), 'Test User');
    await userEvent.type(screen.getByPlaceholderText('Muster Logistik GmbH'), 'Test Company');
    await userEvent.type(screen.getByPlaceholderText('name@firma.de'), 'USER@Example.com');
    await userEvent.click(screen.getByRole('button', { name: /weiter/i }));

    await waitFor(() => {
      expect(mockSeedTrialRegistration).toHaveBeenCalledWith({
        fullName: 'Test User',
        companyName: 'Test Company',
        email: 'user@example.com',
        honeypot: '',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/auth/accept-invite?email=user%40example.com');
  });

  it('zeigt Fehlermeldung bei fehlgeschlagener Registrierung', async () => {
    mockSeedTrialRegistration.mockRejectedValue(
      new PublicRegisterError('Email already registered', 'EMAIL_ALREADY_REGISTERED'),
    );

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('Max Mustermann'), 'Test User');
    await userEvent.type(screen.getByPlaceholderText('Muster Logistik GmbH'), 'Test Company');
    await userEvent.type(screen.getByPlaceholderText('name@firma.de'), 'existing@example.com');
    await userEvent.click(screen.getByRole('button', { name: /weiter/i }));

    expect(await screen.findByText(/Diese E-Mail ist bereits registriert/i)).toBeInTheDocument();
  });
});
