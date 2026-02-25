import React from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

// Indigo/violet palette — professional and calm for auth screens
const COLORS = ['#e0eaff', '#241d9a', '#f75092', '#9f50d3'];

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const AuthShaderBackground: React.FC = () => (
  <MeshGradient
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 0,
      pointerEvents: 'none',
    }}
    colors={COLORS}
    distortion={0.8}
    swirl={0.3}
    speed={prefersReducedMotion ? 0 : 0.3}
  />
);

export default AuthShaderBackground;
