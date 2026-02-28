import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Profile from './ProfilePage';

const baseProps = {
  name: 'Max Mustermann',
  role: 'ADMIN' as const,
  email: 'max@example.com',
  profileAvatarUrl: '',
  profileEmail: 'max@example.com',
  onEmailChange: vi.fn(),
  onAvatarChange: vi.fn(),
  onRequestEmailChange: vi.fn(),
  onRequestPasswordReset: vi.fn(),
  onSaveAvatar: vi.fn(),
  onGoHome: vi.fn(),
  onLogout: vi.fn(),
  onProfile: vi.fn(),
  onAdmin: vi.fn(),
};

describe('Profile', () => {
  it('disables email change button when change is not allowed', () => {
    render(<Profile {...baseProps} canRequestEmailChange={false} />);

    const button = screen.getByRole('button', { name: 'E-Mail ändern' });
    expect(button).toBeDisabled();
  });

  it('triggers password reset callback', async () => {
    const onRequestPasswordReset = vi.fn();
    render(
      <Profile
        {...baseProps}
        canRequestEmailChange
        onRequestPasswordReset={onRequestPasswordReset}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Passwort ändern' }));

    expect(onRequestPasswordReset).toHaveBeenCalledTimes(1);
  });
});
