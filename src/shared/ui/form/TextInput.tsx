import React from 'react';

export const TEXT_INPUT_BASE_CLASS =
  'w-full border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-white border transition-all';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const TextInput: React.FC<TextInputProps> = ({ className = '', ...props }) => {
  return <input {...props} className={`${TEXT_INPUT_BASE_CLASS} ${className}`.trim()} />;
};

export default TextInput;
