import React, { useEffect, useRef } from 'react';
import { renderQRToCanvas } from '../js/exportQr';

interface QRCanvasProps {
  value: string;
  fgColor?: string;
  bgColor?: string;
  logo?: string;
  size?: number;
  className?: string;
}

export const QRCanvas: React.FC<QRCanvasProps> = ({
  value,
  fgColor = '#0F172A',
  bgColor = '#FFFFFF',
  logo = '',
  size = 240,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let active = true;
    renderQRToCanvas(canvas, {
      value: value || 'https://pulseqr.app',
      fgColor,
      bgColor,
      logo,
      size: size * 2,
    }).catch((err) => {
      if (active) console.error('QR render error:', err);
    });
    return () => {
      active = false;
    };
  }, [value, fgColor, bgColor, logo, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`block rounded-xl ${className}`}
      aria-label="Generated QR Code Preview"
    />
  );
};
