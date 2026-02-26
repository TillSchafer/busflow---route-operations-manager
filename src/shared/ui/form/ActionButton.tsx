import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 hover:bg-slate-800 text-white',
  secondary: 'bg-blue-600 hover:bg-blue-500 text-white',
  outline: 'border border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ variant = 'primary', className = '', ...props }) => {
  const base =
    'px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  return <button {...props} className={`${base} ${variantClasses[variant]} ${className}`.trim()} />;
};

export default ActionButton;
