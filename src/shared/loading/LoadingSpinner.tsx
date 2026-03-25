import React from 'react';
import Loader15 from '../components/ui/loader-15';

interface LoadingSpinnerProps {
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className }) => {
  return <Loader15 className={className} data-testid="loading-spinner-loader15" />;
};

export default LoadingSpinner;
