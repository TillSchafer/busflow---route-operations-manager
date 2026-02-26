import React from 'react';

interface FormFieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, hint, className = '', children }) => {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
};

export default FormField;
