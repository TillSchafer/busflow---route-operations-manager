import React from 'react';

const Loader15: React.FC = () => {
  return (
    <span className="relative inline-flex h-6 w-6 items-center justify-center">
      <span className="absolute h-6 w-6 rounded-full border-2 border-slate-300/80" />
      <span className="absolute h-6 w-6 rounded-full border-2 border-transparent border-t-slate-700 animate-spin" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-700/80" />
    </span>
  );
};

export default Loader15;
