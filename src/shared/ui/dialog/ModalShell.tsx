import React from 'react';

interface ModalShellProps {
  isOpen: boolean;
  onBackdropClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({ isOpen, onBackdropClick, className = '', children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={event => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
    >
      <div className={`relative z-[2001] bg-white rounded-xl shadow-2xl w-full ${className}`.trim()}>{children}</div>
    </div>
  );
};

export default ModalShell;
