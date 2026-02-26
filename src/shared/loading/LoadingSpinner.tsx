import React from 'react';
import { Loader2 } from 'lucide-react';
import Loader15 from '@/components/ui/loader-15';

interface LoadingSpinnerProps {
  className?: string;
}

const hasCustomLoader = typeof Loader15 === 'function';

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className }) => {
  if (hasCustomLoader) {
    return (
      <span className={className} data-testid="loading-spinner-loader15">
        <Loader15 />
      </span>
    );
  }

  return <Loader2 className={className} data-testid="loading-spinner-fallback" />;
};

export default LoadingSpinner;
