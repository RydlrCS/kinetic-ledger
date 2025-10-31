import React from 'react';

interface KineticLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function KineticLogo({ size = 'md', className = '' }: KineticLogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className={`${sizes[size]} ${className} relative`}>
      {/* Circular "K" logo with gradient */}
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5ac8fa" />
            <stop offset="100%" stopColor="#277ffe" />
          </linearGradient>
          
          {/* Animated gradient for glow effect */}
          <radialGradient id="glowGradient">
            <stop offset="0%" stopColor="#5ac8fa" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#277ffe" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        {/* Outer circle (ring) */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#logoGradient)"
          strokeWidth="3"
          className="animate-spin-slow"
          style={{ transformOrigin: 'center', animation: 'spin 20s linear infinite' }}
        />
        
        {/* Inner circle glow */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="url(#glowGradient)"
          className="animate-pulse"
        />
        
        {/* "K" letter */}
        <g fill="url(#logoGradient)">
          {/* Vertical line of K */}
          <rect x="35" y="25" width="6" height="50" rx="3" />
          
          {/* Upper diagonal of K */}
          <path d="M 41 50 L 65 25 L 71 28 L 47 53 Z" />
          
          {/* Lower diagonal of K */}
          <path d="M 47 47 L 71 72 L 65 75 L 41 50 Z" />
        </g>
        
        {/* Dot accents (Polkadot-inspired) */}
        <circle cx="15" cy="50" r="2" fill="#5ac8fa" className="animate-pulse" style={{ animationDelay: '0s' }} />
        <circle cx="85" cy="50" r="2" fill="#277ffe" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
        <circle cx="50" cy="15" r="2" fill="#5ac8fa" className="animate-pulse" style={{ animationDelay: '1s' }} />
        <circle cx="50" cy="85" r="2" fill="#277ffe" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
      </svg>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
