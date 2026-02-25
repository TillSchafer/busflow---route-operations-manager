import React from 'react';
import AuthShaderBackground from './AuthShaderBackground';

interface AuthScreenShellProps {
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg';
}

const AuthScreenShell: React.FC<AuthScreenShellProps> = ({ children, maxWidth = 'md' }) => {
  const maxWidthClass = maxWidth === 'lg' ? 'max-w-lg' : 'max-w-md';

  return (
    <div className="min-h-screen relative">
      <AuthShaderBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className={`w-full ${maxWidthClass} bg-white/75 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl px-8 py-8`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthScreenShell;
