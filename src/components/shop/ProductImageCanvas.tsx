import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Hand } from 'lucide-react';

interface ProductImageCanvasProps {
  imageSrc: string;
  altText: string;
  customizationText: string;
  onClick?: () => void;
  onPositionChange?: (x: number, y: number) => void;
  positionX?: number;
  positionY?: number;
}

export interface ProductImageCanvasRef {
  getDataURL: () => string | null;
}

export const ProductImageCanvas = forwardRef<ProductImageCanvasRef, ProductImageCanvasProps>(
  function ProductImageCanvas(
    {
      imageSrc,
      altText,
      customizationText,
      onClick,
      onPositionChange,
      positionX = 50,
      positionY = 72,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [hasDragged, setHasDragged] = useState(false);
    const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
      },
    }));

    useEffect(() => {
      setImageLoaded(false);
      imgRef.current = null;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        setImageLoaded(true);
      };
      img.onerror = () => {
        setImageLoaded(false);
      };
      img.src = imageSrc;
    }, [imageSrc]);

    const drawCanvas = useCallback(() => {
      if (!imageLoaded || !imgRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imgRef.current;
      const size = 800;
      canvas.width = size;
      canvas.height = size;

      ctx.clearRect(0, 0, size, size);
      const bgColor = getComputedStyle(canvas).getPropertyValue('--background').trim();
      ctx.fillStyle = bgColor ? `hsl(${bgColor})` : '#0F0F10';
      ctx.fillRect(0, 0, size, size);

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

      if (customizationText.trim()) {
        const fontSize = Math.max(24, size * 0.045);
        ctx.save();
        ctx.font = `600 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textX = (positionX / 100) * size;
        const textY = (positionY / 100) * size;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(customizationText, textX, textY);

        ctx.restore();
      }
    }, [imageLoaded, imageSrc, customizationText, positionX, positionY]);

    useEffect(() => {
      drawCanvas();
    }, [drawCanvas]);

    const getCanvasCoords = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
    };

    const isOnText = (clientX: number, clientY: number): boolean => {
      if (!customizationText.trim()) return false;
      const coords = getCanvasCoords(clientX, clientY);
      const dx = Math.abs(coords.x - positionX);
      const dy = Math.abs(coords.y - positionY);
      return dx < 15 && dy < 5;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      if (!customizationText.trim()) return;
      if (!isOnText(e.clientX, e.clientY)) return;

      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        posX: positionX,
        posY: positionY,
      };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging || !dragStartRef.current || !canvasRef.current) return;
      e.preventDefault();

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.startX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.startY) / rect.height) * 100;

      const newX = Math.max(5, Math.min(95, dragStartRef.current.posX + deltaX));
      const newY = Math.max(5, Math.min(95, dragStartRef.current.posY + deltaY));

      onPositionChange?.(newX, newY);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setHasDragged(true);
      dragStartRef.current = null;
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
      if (isDragging || hasDragged) {
        // Prevent zoom on drag end - reset after a tick
        setTimeout(() => setHasDragged(false), 100);
        return;
      }
      onClick?.();
    };

    const showHint = customizationText.trim().length > 0 && !hasDragged;

    return (
      <div className="relative w-full h-full">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full ${isDragging ? 'cursor-grabbing' : customizationText.trim() ? 'cursor-grab' : 'cursor-zoom-in'}`}
          style={{ backgroundColor: '#D9D9D9', touchAction: 'none' }}
          aria-label={altText}
        />
        {showHint && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none animate-pulse">
            <Hand className="h-3.5 w-3.5" />
            Arraste o texto na foto para escolher onde gravar
          </div>
        )}
      </div>
    );
  }
);
