import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { ToastProvider } from '../../shared/components/ToastProvider';
import { ProgressProvider } from '../../shared/components/ProgressProvider';
import ProgressViewport from '../../shared/components/ProgressViewport';
import ToastViewport from '../../shared/components/ToastViewport';

interface Props {
  children: React.ReactNode;
}

const AppProviders: React.FC<Props> = ({ children }) => {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProgressProvider>
          {children}
          <ProgressViewport />
          <ToastViewport />
          <SpeedInsights />
          <Analytics />
        </ProgressProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default AppProviders;
