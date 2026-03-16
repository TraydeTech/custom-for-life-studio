import { useRef, useEffect, useState } from 'react';

interface ProductImageCanvasProps {
  imageSrc: string;
  altText: string;
  customizationText: string;
  onClick?: () => void;
}

export function ProductImageCanvas({
  imageSrc,
  altText,
  customizationText,
  onClick,
}: ProductImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    if (!imageLoaded || !imgRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;

    // Set canvas size to match container aspect ratio (1:1)
    const size = 800;
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Fill background
    ctx.fillStyle = '#D9D9D9';
    ctx.fillRect(0, 0, size, size);

    // Draw image centered with scale-125 effect
    const scale = 1.25;
    const imgAspect = img.width / img.height;
    let drawW: number, drawH: number;

    if (imgAspect > 1) {
      drawW = size * scale;
      drawH = (size / imgAspect) * scale;
    } else {
      drawH = size * scale;
      drawW = (size * imgAspect) * scale;
    }

    const drawX = (size - drawW) / 2;
    const drawY = (size - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Draw customization text overlay
    if (customizationText.trim()) {
      const fontSize = Math.max(24, size * 0.045);
      ctx.save();
      ctx.font = `600 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Position text at lower-center of the product
      const textX = size / 2;
      const textY = size * 0.72;

      // Text shadow for contrast
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // Draw text with metallic/laser engraving look
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(customizationText, textX, textY);

      ctx.restore();
    }
  }, [imageLoaded, imageSrc, customizationText]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className="w-full h-full cursor-zoom-in"
      style={{ backgroundColor: '#D9D9D9' }}
      aria-label={altText}
    />
  );
}
