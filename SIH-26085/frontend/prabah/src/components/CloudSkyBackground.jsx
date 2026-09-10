import { useEffect, useRef } from 'react';

export default function CloudSkyBackground({ weatherCode = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let animationId;

    // Cloud generation
    const clouds = [];
    const cloudCount = 8;

    // Create clouds with different sizes and depths
    for (let i = 0; i < cloudCount; i++) {
      clouds.push({
        x: Math.random() * canvas.width * 1.5,
        y: Math.random() * (canvas.height * 0.4) + 30,
        width: 80 + Math.random() * 120,
        height: 40 + Math.random() * 60,
        depth: Math.random() * 0.7 + 0.3, // 0.3 to 1.0
        speed: (Math.random() * 0.5 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
        opacity: 0.4 + Math.random() * 0.4,
        puffs: 3 + Math.floor(Math.random() * 3), // 3-5 puffs per cloud
      });
    }

    // Function to draw a fluffy cloud
    const drawCloud = (x, y, width, height, opacity, puffCount) => {
      const puffRadius = width / (puffCount * 1.5);

      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.globalAlpha = opacity;

      // Draw multiple overlapping circles for fluffy effect
      for (let i = 0; i < puffCount; i++) {
        const offsetX = (i - (puffCount - 1) / 2) * (puffRadius * 0.8);
        const offsetY = Math.sin((i / puffCount) * Math.PI) * (puffRadius * 0.3);

        // Main puff
        ctx.beginPath();
        ctx.arc(x + offsetX, y + offsetY, puffRadius, 0, Math.PI * 2);
        ctx.fill();

        // Secondary puff for more dimension
        ctx.beginPath();
        ctx.arc(x + offsetX, y + offsetY - puffRadius * 0.5, puffRadius * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    // Function to draw the sky gradient based on weather
    const drawSky = () => {
      let topColor, bottomColor;

      // Determine sky colors based on weather code
      if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
        // Thunderstorm - dark gray sky
        topColor = 'rgba(45, 55, 75, 1)';
        bottomColor = 'rgba(85, 100, 130, 1)';
      } else if (weatherCode >= 71 && weatherCode <= 86) {
        // Snow - very light gray/blue
        topColor = 'rgba(200, 210, 225, 1)';
        bottomColor = 'rgba(220, 225, 235, 1)';
      } else if (weatherCode >= 51 && weatherCode <= 67) {
        // Rain/Drizzle - gray-blue
        topColor = 'rgba(100, 130, 160, 1)';
        bottomColor = 'rgba(150, 170, 190, 1)';
      } else if (weatherCode >= 45 && weatherCode <= 48) {
        // Fog - very muted
        topColor = 'rgba(140, 150, 165, 1)';
        bottomColor = 'rgba(170, 180, 190, 1)';
      } else if (weatherCode === 3) {
        // Overcast - gray
        topColor = 'rgba(130, 150, 175, 1)';
        bottomColor = 'rgba(170, 185, 205, 1)';
      } else if (weatherCode === 2) {
        // Partly cloudy - light blue
        topColor = 'rgba(135, 206, 235, 1)';
        bottomColor = 'rgba(176, 224, 230, 1)';
      } else {
        // Clear - bright blue
        topColor = 'rgba(87, 182, 239, 1)';
        bottomColor = 'rgba(180, 220, 245, 1)';
      }

      // Draw sky gradient from top to bottom
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, topColor);
      gradient.addColorStop(1, bottomColor);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const animate = () => {
      // Draw sky background
      drawSky();

      // Sort clouds by depth for proper layering
      clouds.sort((a, b) => a.depth - b.depth);

      // Draw and animate clouds
      for (let cloud of clouds) {
        // Update position
        cloud.x += cloud.speed * cloud.depth * 0.5;

        // Wrap around screen
        if (cloud.x < -cloud.width * 1.5) {
          cloud.x = canvas.width + cloud.width;
        } else if (cloud.x > canvas.width + cloud.width * 1.5) {
          cloud.x = -cloud.width;
        }

        // Draw cloud
        drawCloud(
          cloud.x,
          cloud.y,
          cloud.width * cloud.depth,
          cloud.height * cloud.depth,
          cloud.opacity * (0.5 + cloud.depth * 0.5), // Opacity varies with depth
          cloud.puffs
        );
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, [weatherCode]);

  return (
    <canvas
      ref={canvasRef}
      className="cloud-sky-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
