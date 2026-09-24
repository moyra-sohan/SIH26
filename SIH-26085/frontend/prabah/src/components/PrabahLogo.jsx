import prabahLogoImg from '../assets/prabah.png';

/**
 * PRABAH Official Logo Component
 * Renders the official circular wave emblem (prabah.png)
 */
export default function PrabahLogo({ size = 44, className = '', alt = 'PRABAH Logo' }) {
  return (
    <img
      src={prabahLogoImg}
      alt={alt}
      width={size}
      height={size}
      className={`prabah-logo ${className}`.trim()}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    />
  );
}
