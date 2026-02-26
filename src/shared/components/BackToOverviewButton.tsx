import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

const BackToOverviewButton: React.FC<Props> = ({
  onClick,
  label = 'Zur Übersicht',
  className = '',
  disabled = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    <ArrowLeft className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

export default BackToOverviewButton;
