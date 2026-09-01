/**
 * PRABAH Professional Logo Component
 * Modern, impressive logo for Flood Nowcasting System
 * Premium design with visual depth and elegance
 */

export default function PrabahLogo({ size = 44 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="prabah-logo"
    >
      {/* Define gradients and filters */}
      <defs>
        <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="1" />
          <stop offset="50%" stopColor="#0891b2" stopOpacity="1" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="1" />
        </linearGradient>
        
        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="1" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
        </linearGradient>

        <radialGradient id="glowGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
        </radialGradient>

        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Outer glow circle */}
      <circle cx="60" cy="60" r="55" fill="url(#glowGrad)" />

      {/* Background circle with gradient border */}
      <circle cx="60" cy="60" r="52" fill="white" opacity="0.08" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="url(#mainGradient)" strokeWidth="2" opacity="0.4" />

      {/* Premium water droplet - main element */}
      <g filter="url(#glow)">
        {/* Droplet shadow */}
        <path
          d="M 60 28 C 72 40 82 50 82 62 C 82 78 72 88 60 88 C 48 88 38 78 38 62 C 38 50 48 40 60 28"
          fill="url(#mainGradient)"
          opacity="0.35"
          transform="translate(2, 3)"
        />
        
        {/* Droplet main */}
        <path
          d="M 60 28 C 72 40 82 50 82 62 C 82 78 72 88 60 88 C 48 88 38 78 38 62 C 38 50 48 40 60 28"
          fill="url(#mainGradient)"
          opacity="0.95"
        />
        
        {/* Droplet highlights for dimension */}
        <ellipse cx="56" cy="46" rx="8" ry="14" fill="white" opacity="0.35" />
        <ellipse cx="54" cy="54" rx="5" ry="8" fill="white" opacity="0.15" />
      </g>

      {/* Wave indicators - dynamic flowing element */}
      <g strokeLinecap="round" strokeLinejoin="round">
        {/* Wave 1 - prominent */}
        <path
          d="M 25 72 Q 32 68 39 72 Q 46 76 53 72 Q 60 68 67 72 Q 74 76 81 72 Q 88 68 95 72"
          stroke="url(#accentGradient)"
          strokeWidth="3.5"
          fill="none"
          opacity="0.9"
        />
        
        {/* Wave 2 - flowing */}
        <path
          d="M 25 84 Q 32 80 39 84 Q 46 88 53 84 Q 60 80 67 84 Q 74 88 81 84 Q 88 80 95 84"
          stroke="url(#accentGradient)"
          strokeWidth="2.5"
          fill="none"
          opacity="0.7"
        />
      </g>

      {/* Data points - represents nowcasting/real-time monitoring */}
      <g>
        {/* Outer rings for data points */}
        <circle cx="95" cy="50" r="4" fill="none" stroke="url(#accentGradient)" strokeWidth="1.5" opacity="0.5" />
        <circle cx="95" cy="50" r="2.5" fill="url(#accentGradient)" opacity="0.9" />
        
        <circle cx="98" cy="62" r="4" fill="none" stroke="url(#accentGradient)" strokeWidth="1.5" opacity="0.4" />
        <circle cx="98" cy="62" r="2.5" fill="url(#accentGradient)" opacity="0.8" />
      </g>

      {/* Center emphasis dot */}
      <circle cx="60" cy="60" r="3.5" fill="url(#accentGradient)" opacity="0.8" />

      {/* Outer elegant ring */}
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke="url(#accentGradient)"
        strokeWidth="1"
        opacity="0.5"
      />
    </svg>
  );
}
