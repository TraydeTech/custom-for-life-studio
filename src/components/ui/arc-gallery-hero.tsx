'use client';

import React, { useEffect, useState } from 'react';

type ArcGalleryHeroProps = {
  images: string[];
  startAngle?: number;
  endAngle?: number;
  radiusLg?: number;
  radiusMd?: number;
  radiusSm?: number;
  cardSizeLg?: number;
  cardSizeMd?: number;
  cardSizeSm?: number;
  className?: string;
  title?: React.ReactNode;
  subtitle?: string;
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
};

export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({
  images,
  startAngle = 20,
  endAngle = 160,
  radiusLg = 480,
  radiusMd = 360,
  radiusSm = 260,
  cardSizeLg = 120,
  cardSizeMd = 100,
  cardSizeSm = 80,
  className = '',
  title,
  subtitle,
  ctaPrimary,
  ctaSecondary,
}) => {
  const [dimensions, setDimensions] = useState({
    radius: radiusLg,
    cardSize: cardSizeLg,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setDimensions({ radius: radiusSm, cardSize: cardSizeSm });
      } else if (width < 1024) {
        setDimensions({ radius: radiusMd, cardSize: cardSizeMd });
      } else {
        setDimensions({ radius: radiusLg, cardSize: cardSizeLg });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [radiusLg, radiusMd, radiusSm, cardSizeLg, cardSizeMd, cardSizeSm]);

  const count = Math.max(images.length, 2);
  const step = (endAngle - startAngle) / (count - 1);

  return (
    <section
      className={`relative w-full overflow-hidden bg-background ${className}`}
      style={{ minHeight: '100vh' }}
    >
      {/* Arc container */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          width: dimensions.radius * 2 + dimensions.cardSize,
          height: dimensions.radius + dimensions.cardSize,
          top: '0',
        }}
      >
        {/* Center pivot at bottom center */}
        <div
          className="absolute"
          style={{
            left: '50%',
            bottom: '0',
            transform: 'translate(-50%, 0)',
          }}
        >
          {images.map((src, i) => {
            const angle = startAngle + step * i;
            const angleRad = (angle * Math.PI) / 180;

            const x = Math.cos(angleRad) * dimensions.radius;
            const y = Math.sin(angleRad) * dimensions.radius;

            return (
              <div
                key={i}
                className="absolute"
                style={{
                  width: dimensions.cardSize,
                  height: dimensions.cardSize,
                  left: x - dimensions.cardSize / 2,
                  bottom: y - dimensions.cardSize / 2,
                  transform: `rotate(${90 - angle}deg)`,
                  opacity: 0,
                  animation: `arc-fade-in 0.5s ease-out ${i * 0.08}s forwards`,
                }}
              >
                <div className="w-full h-full rounded-xl overflow-hidden shadow-lg border-2 border-border hover:border-primary/50 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:z-10">
                  <img
                    src={src}
                    alt={`Produto ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        '/placeholder.svg';
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content below the arc */}
      <div
        className="absolute left-1/2 w-full px-4"
        style={{
          top: '55%',
          transform: 'translate(-50%, 0)',
          animation: 'arc-content-in 0.8s ease-out 0.6s both',
        }}
      >
        <div className="max-w-2xl mx-auto text-center">
          {title && (
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-heading font-bold mb-6 leading-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              {subtitle}
            </p>
          )}
          {(ctaPrimary || ctaSecondary) && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {ctaPrimary && (
                <a
                  href={ctaPrimary.href}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-8 py-4 text-lg font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  {ctaPrimary.label}
                </a>
              )}
              {ctaSecondary && (
                <a
                  href={ctaSecondary.href}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-primary px-8 py-4 text-lg font-bold text-foreground hover:bg-primary/10 transition-all duration-300"
                >
                  {ctaSecondary.label}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes arc-fade-in {
          from {
            opacity: 0;
            transform: rotate(var(--tw-rotate, 0deg)) scale(0.5);
          }
          to {
            opacity: 1;
            transform: rotate(var(--tw-rotate, 0deg)) scale(1);
          }
        }
        @keyframes arc-content-in {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </section>
  );
};
