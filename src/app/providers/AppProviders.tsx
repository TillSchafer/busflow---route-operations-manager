import React from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { ToastProvider } from '../../shared/components/ToastProvider';
import { ProgressProvider } from '../../shared/components/ProgressProvider';
import ProgressViewport from '../../shared/components/ProgressViewport';
import ToastViewport from '../../shared/components/ToastViewport';
import { LoadingProvider, FullPageLoadingScreen } from '../../shared/loading';

interface Props {
  children: React.ReactNode;
}

const AppProviders: React.FC<Props> = ({ children }) => {
  return (
    <AuthProvider>
      <ToastProvider>
        <LoadingProvider>
          <ProgressProvider>
            {children}
            <ProgressViewport />
            <FullPageLoadingScreen />
            <ToastViewport />
            <SpeedInsights />
            <Analytics />
          </ProgressProvider>
        </LoadingProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default AppProviders;
