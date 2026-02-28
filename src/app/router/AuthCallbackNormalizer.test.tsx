import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AuthCallbackNormalizer from './AuthCallbackNormalizer';

const LocationProbe = () => {
  const location = useLocation();
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </p>
  );
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthCallbackNormalizer />
      <LocationProbe />
    </MemoryRouter>,
  );

describe('AuthCallbackNormalizer', () => {
  it('leitet signup callback params auf /auth/accept-invite um', async () => {
    renderAt('/?type=signup&token_hash=abc123');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/auth/accept-invite?type=signup&token_hash=abc123');
    });
  });

  it('leitet email_change callback params auf /auth/account-security um', async () => {
    renderAt('/?type=email_change&token_hash=abc123');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/auth/account-security?type=email_change&token_hash=abc123');
    });
  });

  it('belässt normale Routen ohne Callback-Parameter unverändert', async () => {
    renderAt('/auth/register');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/auth/register');
    });
  });
});
