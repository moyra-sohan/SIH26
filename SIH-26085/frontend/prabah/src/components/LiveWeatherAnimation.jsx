import { useEffect, useRef } from 'react';

export default function LiveWeatherAnimation({ isActive = true }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!isActive) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Rain particles
    const raindrops = [];
    const rainCount = 100;
    
    // Create rain particles
    for (let i = 0; i < rainCount; i++) {
      raindrops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        velocity: 3 + Math.random() * 4,
        opacity: Math.random() * 0.5 + 0.3,
        length: 12 + Math.random() * 8,
      });
    }
    
    // Lightning state
    let lightningCounter = 0;
    let lightningIntensity = 0;
    
    const drawRain = () => {
      for (let drop of raindrops) {
        ctx.strokeStyle = `rgba(200, 220, 240, ${drop.opacity})`;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 1, drop.y + drop.length);
        ctx.stroke();
        
        // Update position
        drop.y += drop.velocity;
        drop.x -= drop.velocity * 0.3;
        
        // Reset when off screen
        if (drop.y > canvas.height) {
          drop.y = -drop.length;
          drop.x = Math.random() * canvas.width;
        }
        
        if (drop.x < 0) {
          drop.x = canvas.width;
        }
      }
    };
    
    const drawLightning = () => {
      if (lightningIntensity > 0) {
        // Lightning flash effect
        ctx.fillStyle = `rgba(255, 255, 255, ${lightningIntensity * 0.3})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Lightning bolt
        ctx.strokeStyle = `rgba(255, 255, 100, ${lightningIntensity})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Random lightning path
        const startX = canvas.width * (0.2 + Math.random() * 0.6);
        let x = startX;
        let y = 0;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        while (y < canvas.height) {
          x += (Math.random() - 0.5) * 50;
          y += canvas.height * 0.1;
          ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        
        // Glow effect
        ctx.strokeStyle = `rgba(200, 200, 255, ${lightningIntensity * 0.3})`;
        ctx.lineWidth = 8;
        ctx.stroke();
      }
    };
    
    const drawThunder = () => {
      // Thunder rumble - randomly trigger lightning
      lightningCounter++;
      
      // Random lightning strikes
      if (lightningCounter > 80 && Math.random() > 0.95) {
        lightningIntensity = 1;
        lightningCounter = 0;
      } else if (lightningCounter > 5) {
        lightningIntensity = Math.max(0, lightningIntensity - 0.15);
      }
    };
    
    const animate = () => {
      // Clear canvas with semi-transparent overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      drawRain();
      drawThunder();
      drawLightning();
      
      requestAnimationFrame(animate);
    };
    
    animate();
    
    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isActive]);
  
  if (!isActive) return null;
  
  return (
    <canvas
      ref={canvasRef}
      className="weather-animation-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
