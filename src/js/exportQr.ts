import QRCode from 'qrcode';
import JSZip from 'jszip';

export interface QRRenderOptions {
  value: string;
  fgColor: string;
  bgColor: string;
  logo?: string;
  size?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Renders a high-resolution QR code onto a canvas with optional centered brand logo.
 */
export async function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  options: QRRenderOptions
): Promise<void> {
  const size = options.size ?? 512;
  canvas.width = size;
  canvas.height = size;

  await QRCode.toCanvas(canvas, options.value || 'https://pulseqr.app', {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: options.fgColor || '#0F172A',
      light: options.bgColor || '#FFFFFF',
    },
  });

  if (options.logo) {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = await loadImage(options.logo);
      const logoSize = Math.round(size * 0.22);
      const pad = Math.round(size * 0.025);
      const boxSize = logoSize + pad * 2;
      const x = Math.round((size - boxSize) / 2);
      const y = Math.round((size - boxSize) / 2);
      const radius = Math.round(boxSize * 0.2);

      ctx.save();
      ctx.fillStyle = options.bgColor || '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(x, y, boxSize, boxSize, radius);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad, logoSize, logoSize, Math.round(radius * 0.7));
      ctx.clip();
      ctx.drawImage(img, x + pad, y + pad, logoSize, logoSize);
      ctx.restore();
    } catch {
      // If external logo fails CORS, keep crisp QR without logo
    }
  }
}

export async function generateQRPngDataUrl(options: QRRenderOptions): Promise<string> {
  const canvas = document.createElement('canvas');
  await renderQRToCanvas(canvas, { ...options, size: options.size ?? 1024 });
  return canvas.toDataURL('image/png');
}

export async function generateQRSvgString(options: QRRenderOptions): Promise<string> {
  const rawSvg = await QRCode.toString(options.value || 'https://pulseqr.app', {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: options.fgColor || '#0F172A',
      light: options.bgColor || '#FFFFFF',
    },
  });

  if (!options.logo) {
    return rawSvg;
  }

  // Embed centered logo cleanly inside the SVG viewBox
  const vbMatch = rawSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const dim = vbMatch ? Number(vbMatch[1]) : 41;
  const logoSize = dim * 0.22;
  const pad = dim * 0.03;
  const box = logoSize + pad * 2;
  const bx = (dim - box) / 2;
  const by = (dim - box) / 2;
  const lx = (dim - logoSize) / 2;
  const ly = (dim - logoSize) / 2;

  const escapedLogo = options.logo.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const overlay = `<rect x="${bx}" y="${by}" width="${box}" height="${box}" rx="${box * 0.18}" fill="${options.bgColor || '#FFFFFF'}"/><image href="${escapedLogo}" x="${lx}" y="${ly}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid slice"/>`;

  return rawSvg.replace('</svg>', `${overlay}</svg>`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadQRPng(options: QRRenderOptions, filename: string, highRes = false) {
  const dataUrl = await generateQRPngDataUrl({
    ...options,
    size: highRes ? 2048 : 1024,
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  triggerDownload(blob, `${filename}${highRes ? '-print-2048px' : ''}.png`);
}

export async function downloadQRSvg(options: QRRenderOptions, filename: string) {
  const svg = await generateQRSvgString(options);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `${filename}.svg`);
}

export async function downloadBulkQRZip(
  items: { filename: string; options: QRRenderOptions }[],
  zipName = 'pulseqr-bulk-export.zip'
): Promise<void> {
  const zip = new JSZip();
  for (const item of items) {
    const svg = await generateQRSvgString(item.options);
    const pngDataUrl = await generateQRPngDataUrl({ ...item.options, size: 1024 });
    const base64 = pngDataUrl.split(',')[1];
    zip.file(`${item.filename}.svg`, svg);
    zip.file(`${item.filename}.png`, base64, { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, zipName);
}
