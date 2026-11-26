import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getShortUrl } from './qrFormats';
import type { PaperSize } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const DEFAULT_GOOGLE_REVIEW_TEMPLATE =
  '/assets/aistudio/WE_WOULD_APPRECIATE_YOUR_GOOGLE_REVIEW__7cf3171c.png';

/**
 * Pixel-calibrated QR bounding box for the uploaded 1200x1200 Google Review NFC/QR card.
 * Places the square Dynamic QR perfectly centered directly below "Scan QR code"
 * without touching the blue header, 5 stars, Google badge, "OR", NFC icon, or "Tap your phone".
 */
export const DEFAULT_GOOGLE_REVIEW_QR_BOX = {
  xPercent: 60.5,
  yPercent: 59.5,
  sizePercent: 31.5,
};

export const PAPER_SIZES: Record<PaperSize, { label: string; widthMm: number; heightMm: number }> = {
  A4: { label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  A5: { label: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  Letter: { label: 'US Letter (215.9 × 279.4 mm)', widthMm: 215.9, heightMm: 279.4 },
  Custom: { label: 'Custom Dimensions', widthMm: 210, heightMm: 297 },
};

export const CARD_DIMENSION_PRESETS = [
  { label: '85 × 85 mm (Google Review Square)', widthMm: 85, heightMm: 85, cols: 2, rows: 3 },
  { label: '90 × 54 mm (Standard Print Card)', widthMm: 90, heightMm: 54, cols: 2, rows: 5 },
  { label: '85.6 × 54 mm (CR80 PVC / NFC Card)', widthMm: 85.6, heightMm: 54, cols: 2, rows: 5 },
  { label: '100 × 100 mm (Table Stand)', widthMm: 100, heightMm: 100, cols: 2, rows: 2 },
];

export const PRINT_DPI = 300;
const MM_PER_INCH = 25.4;

export function mmToPx(mm: number, dpi = PRINT_DPI): number {
  return Math.max(1, Math.round((mm / MM_PER_INCH) * dpi));
}

export interface PrintSheetSettings {
  templateSrc: string;
  paperSize: PaperSize;
  paperWidthMm: number;
  paperHeightMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  rows: number;
  cols: number;
  gapMm: number;
  cropMarks: boolean;
  qrXPercent: number;
  qrYPercent: number;
  qrSizePercent: number;
  qrColor: string;
  qrBgColor: string;
  showCardNumberCaption?: boolean;
  batchName: string;
}

export interface PrintableCardItem {
  qrId: string;
  cardNumber?: string;
}

/**
 * Loads an uploaded PNG, JPG, SVG, or PDF card template and converts PDF page 1
 * into a crisp high-resolution PNG data URL while keeping PNG/JPG/SVG lossless.
 */
export async function parseTemplateFile(file: File): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  fileType: string;
}> {
  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');

  if (isPdf) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 3.0 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to initialize canvas for PDF template.');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    return { dataUrl, width: canvas.width, height: canvas.height, fileType: 'PDF' };
  }

  // PNG, JPG, SVG
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read uploaded template file.'));
    reader.readAsDataURL(file);
  });

  const img = await loadImage(rawDataUrl);
  // Rasterize SVG onto high-res 1800px canvas for consistent PDF/PNG embedding
  if (file.type === 'image/svg+xml' || lowerName.endsWith('.svg')) {
    const targetW = Math.max(img.naturalWidth || 1200, 1500);
    const aspect = (img.naturalHeight || 1200) / (img.naturalWidth || 1200);
    const targetH = Math.round(targetW * aspect);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return {
        dataUrl: canvas.toDataURL('image/png', 1.0),
        width: targetW,
        height: targetH,
        fileType: 'SVG',
      };
    }
  }

  return {
    dataUrl: rawDataUrl,
    width: img.naturalWidth || 1200,
    height: img.naturalHeight || 1200,
    fileType: file.type.includes('png') ? 'PNG' : 'JPG',
  };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Unable to load card template image (${src.slice(0, 60)})`));
    img.src = src;
  });
}

/**
 * Generates a high-contrast square QR canvas for a specific dynamic card URL (`domain.com/r/{qrId}`).
 */
async function renderQRMatrixCanvas(
  url: string,
  sizePx: number,
  fgColor: string,
  bgColor: string
): Promise<HTMLCanvasElement> {
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, url, {
    width: Math.max(128, Math.round(sizePx)),
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: fgColor || '#0F172A',
      light: bgColor || '#FFFFFF',
    },
  });
  return qrCanvas;
}

/**
 * Draws a single card onto a target canvas context at exact coordinates (x, y, w, h)
 * while preserving 100% of the uploaded template's design, colors, Google logo, stars, text, and NFC icon,
 * and placing the unique Dynamic QR centered cleanly inside the QR placeholder.
 */
export async function drawCompositeCard(
  ctx: CanvasRenderingContext2D,
  templateImg: HTMLImageElement,
  qrId: string,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  options: {
    qrXPercent: number;
    qrYPercent: number;
    qrSizePercent: number;
    qrColor: string;
    qrBgColor: string;
    cardNumber?: string;
    showCardNumberCaption?: boolean;
  }
): Promise<void> {
  ctx.save();
  // Clean white card substrate
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, cardW, cardH);

  // Preserve template aspect ratio without distorting circular logos/stars;
  // if card aspect matches template closely (<8% delta), fill edge-to-edge cleanly.
  const tplAspect = (templateImg.naturalWidth || 1) / (templateImg.naturalHeight || 1);
  const cardAspect = cardW / cardH;
  const aspectDelta = Math.abs(tplAspect - cardAspect) / Math.max(tplAspect, cardAspect);

  let drawX = x;
  let drawY = y;
  let drawW = cardW;
  let drawH = cardH;

  if (aspectDelta > 0.08) {
    // Letterbox-fit so the Google G circle, stars, and NFC icon never stretch
    if (cardAspect > tplAspect) {
      drawH = cardH;
      drawW = cardH * tplAspect;
      drawX = x + (cardW - drawW) / 2;
    } else {
      drawW = cardW;
      drawH = cardW / tplAspect;
      drawY = y + (cardH - drawH) / 2;
    }
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(templateImg, drawX, drawY, drawW, drawH);

  // Compute exact square QR geometry anchored to the template artwork
  const qrSize = (options.qrSizePercent / 100) * Math.min(drawW, drawH);
  const qrLeft = drawX + (options.qrXPercent / 100) * drawW;
  const qrTop = drawY + (options.qrYPercent / 100) * drawH;

  // Render crisp dynamic QR encoding `domain.com/r/{qrId}`
  const dynamicUrl = getShortUrl(qrId);
  const qrCanvas = await renderQRMatrixCanvas(
    dynamicUrl,
    qrSize,
    options.qrColor,
    options.qrBgColor
  );

  // Clean placeholder mask so any existing placeholder graphic in custom templates is completely replaced
  ctx.fillStyle = options.qrBgColor || '#FFFFFF';
  ctx.fillRect(qrLeft, qrTop, qrSize, qrSize);
  ctx.drawImage(qrCanvas, qrLeft, qrTop, qrSize, qrSize);

  // Optional tiny serial caption (disabled by default to keep template 100% pure)
  if (options.showCardNumberCaption && options.cardNumber) {
    ctx.fillStyle = '#475569';
    ctx.font = `600 ${Math.max(12, Math.round(drawH * 0.019))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(options.cardNumber, qrLeft + qrSize / 2, qrTop + qrSize + Math.round(drawH * 0.025));
  }

  ctx.restore();
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function computeGridLayout(settings: PrintSheetSettings) {
  const { paperWidthMm, paperHeightMm, cardWidthMm, cardHeightMm, rows, cols, gapMm } = settings;
  const totalGridW = cols * cardWidthMm + Math.max(0, cols - 1) * gapMm;
  const totalGridH = rows * cardHeightMm + Math.max(0, rows - 1) * gapMm;
  const marginX = Math.max(4, (paperWidthMm - totalGridW) / 2);
  const marginY = Math.max(4, (paperHeightMm - totalGridH) / 2);
  const cardsPerSheet = Math.max(1, rows * cols);
  return { totalGridW, totalGridH, marginX, marginY, cardsPerSheet };
}

/**
 * Generates a print-ready multi-page PDF (A4, A5, Letter, or Custom) at 300 DPI
 * with exact millimeter dimensions, centered margins, and crisp printer crop marks.
 */
export async function generatePrintPDF(
  cards: PrintableCardItem[],
  settings: PrintSheetSettings,
  onProgress?: (current: number, total: number, label: string) => void
): Promise<void> {
  if (cards.length === 0) throw new Error('No cards to generate.');

  const templateImg = await loadImage(settings.templateSrc);
  const { marginX, marginY, cardsPerSheet } = computeGridLayout(settings);
  const totalSheets = Math.ceil(cards.length / cardsPerSheet);

  const orientation = settings.paperWidthMm > settings.paperHeightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [settings.paperWidthMm, settings.paperHeightMm],
    compress: true,
  });

  // Reusable 300 DPI single-card scratch canvas
  const cardPxW = mmToPx(settings.cardWidthMm, PRINT_DPI);
  const cardPxH = mmToPx(settings.cardHeightMm, PRINT_DPI);
  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = cardPxW;
  cardCanvas.height = cardPxH;
  const cardCtx = cardCanvas.getContext('2d');
  if (!cardCtx) throw new Error('Unable to initialize 300 DPI card canvas.');

  let renderedCount = 0;

  for (let sheetIdx = 0; sheetIdx < totalSheets; sheetIdx++) {
    if (sheetIdx > 0) {
      pdf.addPage([settings.paperWidthMm, settings.paperHeightMm], orientation);
    }

    const sheetCards = cards.slice(sheetIdx * cardsPerSheet, (sheetIdx + 1) * cardsPerSheet);

    for (let slot = 0; slot < sheetCards.length; slot++) {
      const card = sheetCards[slot];
      const r = Math.floor(slot / settings.cols);
      const c = slot % settings.cols;
      const xMm = marginX + c * (settings.cardWidthMm + settings.gapMm);
      const yMm = marginY + r * (settings.cardHeightMm + settings.gapMm);

      cardCtx.clearRect(0, 0, cardPxW, cardPxH);
      await drawCompositeCard(cardCtx, templateImg, card.qrId, 0, 0, cardPxW, cardPxH, {
        qrXPercent: settings.qrXPercent,
        qrYPercent: settings.qrYPercent,
        qrSizePercent: settings.qrSizePercent,
        qrColor: settings.qrColor,
        qrBgColor: settings.qrBgColor,
        cardNumber: card.cardNumber,
        showCardNumberCaption: settings.showCardNumberCaption,
      });

      // Embed lossless-quality 300 DPI card raster at exact millimeter footprint
      const cardDataUrl = cardCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(cardDataUrl, 'JPEG', xMm, yMm, settings.cardWidthMm, settings.cardHeightMm, undefined, 'FAST');

      // Subtle hairline cut outline + vector printer crop marks outside each corner
      if (settings.cropMarks) {
        const markLen = 4; // 4mm crop tick
        const offset = 1.5; // 1.5mm bleed offset
        pdf.setDrawColor(60, 60, 60);
        pdf.setLineWidth(0.18);

        const x1 = xMm;
        const y1 = yMm;
        const x2 = xMm + settings.cardWidthMm;
        const y2 = yMm + settings.cardHeightMm;

        // Top-left
        pdf.line(x1 - offset - markLen, y1, x1 - offset, y1);
        pdf.line(x1, y1 - offset - markLen, x1, y1 - offset);
        // Top-right
        pdf.line(x2 + offset, y1, x2 + offset + markLen, y1);
        pdf.line(x2, y1 - offset - markLen, x2, y1 - offset);
        // Bottom-left
        pdf.line(x1 - offset - markLen, y2, x1 - offset, y2);
        pdf.line(x1, y2 + offset, x1, y2 + offset + markLen);
        // Bottom-right
        pdf.line(x2 + offset, y2, x2 + offset + markLen, y2);
        pdf.line(x2, y2 + offset, x2, y2 + offset + markLen);
      }

      renderedCount++;
      if (renderedCount % 4 === 0 || renderedCount === cards.length) {
        onProgress?.(
          renderedCount,
          cards.length,
          `Rendering PDF sheet ${sheetIdx + 1}/${totalSheets} (${renderedCount}/${cards.length} cards at 300 DPI)...`
        );
        await yieldToMainThread();
      }
    }

    // Quiet print-production footer outside cut area
    pdf.setFontSize(7);
    pdf.setTextColor(120, 128, 140);
    const firstLabel = sheetCards[0]?.cardNumber || sheetCards[0]?.qrId || '';
    const lastLabel = sheetCards[sheetCards.length - 1]?.cardNumber || sheetCards[sheetCards.length - 1]?.qrId || '';
    pdf.text(
      `${settings.batchName}  |  Sheet ${sheetIdx + 1} of ${totalSheets}  |  ${firstLabel} – ${lastLabel}  |  300 DPI Print Ready`,
      settings.paperWidthMm / 2,
      settings.paperHeightMm - 4,
      { align: 'center' }
    );
  }

  const safeFileName = (settings.batchName || 'pulseqr-cards')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  pdf.save(`${safeFileName || 'pulseqr-batch'}-${cards.length}cards-300dpi.pdf`);
}

/**
 * Generates high-resolution 300 DPI PNG sheets (e.g. 2480 × 3508 px for A4) with crop marks.
 * Downloads a single PNG if 1 sheet, or a ZIP archive containing all 300 DPI PNG sheets if >1 sheet.
 */
export async function generatePrintPNGSheets(
  cards: PrintableCardItem[],
  settings: PrintSheetSettings,
  onProgress?: (current: number, total: number, label: string) => void
): Promise<void> {
  if (cards.length === 0) throw new Error('No cards to export.');

  const templateImg = await loadImage(settings.templateSrc);
  const { marginX, marginY, cardsPerSheet } = computeGridLayout(settings);
  const totalSheets = Math.ceil(cards.length / cardsPerSheet);

  const sheetPxW = mmToPx(settings.paperWidthMm, PRINT_DPI);
  const sheetPxH = mmToPx(settings.paperHeightMm, PRINT_DPI);
  const cardPxW = mmToPx(settings.cardWidthMm, PRINT_DPI);
  const cardPxH = mmToPx(settings.cardHeightMm, PRINT_DPI);
  const gapPx = mmToPx(settings.gapMm, PRINT_DPI);
  const marginXPx = mmToPx(marginX, PRINT_DPI);
  const marginYPx = mmToPx(marginY, PRINT_DPI);

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = sheetPxW;
  sheetCanvas.height = sheetPxH;
  const ctx = sheetCanvas.getContext('2d');
  if (!ctx) throw new Error('Unable to initialize 300 DPI sheet canvas.');

  const zip = totalSheets > 1 ? new JSZip() : null;
  const safeFileName =
    (settings.batchName || 'pulseqr-cards')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'pulseqr-batch';

  let renderedCount = 0;

  for (let sheetIdx = 0; sheetIdx < totalSheets; sheetIdx++) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sheetPxW, sheetPxH);

    const sheetCards = cards.slice(sheetIdx * cardsPerSheet, (sheetIdx + 1) * cardsPerSheet);

    for (let slot = 0; slot < sheetCards.length; slot++) {
      const card = sheetCards[slot];
      const r = Math.floor(slot / settings.cols);
      const c = slot % settings.cols;
      const xPx = marginXPx + c * (cardPxW + gapPx);
      const yPx = marginYPx + r * (cardPxH + gapPx);

      await drawCompositeCard(ctx, templateImg, card.qrId, xPx, yPx, cardPxW, cardPxH, {
        qrXPercent: settings.qrXPercent,
        qrYPercent: settings.qrYPercent,
        qrSizePercent: settings.qrSizePercent,
        qrColor: settings.qrColor,
        qrBgColor: settings.qrBgColor,
        cardNumber: card.cardNumber,
        showCardNumberCaption: settings.showCardNumberCaption,
      });

      if (settings.cropMarks) {
        const markLen = mmToPx(4, PRINT_DPI);
        const offset = mmToPx(1.5, PRINT_DPI);
        ctx.save();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;

        const x1 = xPx;
        const y1 = yPx;
        const x2 = xPx + cardPxW;
        const y2 = yPx + cardPxH;

        ctx.beginPath();
        // Top-left
        ctx.moveTo(x1 - offset - markLen, y1);
        ctx.lineTo(x1 - offset, y1);
        ctx.moveTo(x1, y1 - offset - markLen);
        ctx.lineTo(x1, y1 - offset);
        // Top-right
        ctx.moveTo(x2 + offset, y1);
        ctx.lineTo(x2 + offset + markLen, y1);
        ctx.moveTo(x2, y1 - offset - markLen);
        ctx.lineTo(x2, y1 - offset);
        // Bottom-left
        ctx.moveTo(x1 - offset - markLen, y2);
        ctx.lineTo(x1 - offset, y2);
        ctx.moveTo(x1, y2 + offset);
        ctx.lineTo(x1, y2 + offset + markLen);
        // Bottom-right
        ctx.moveTo(x2 + offset, y2);
        ctx.lineTo(x2 + offset + markLen, y2);
        ctx.moveTo(x2, y2 + offset);
        ctx.lineTo(x2, y2 + offset + markLen);
        ctx.stroke();
        ctx.restore();
      }

      renderedCount++;
      if (renderedCount % 4 === 0 || renderedCount === cards.length) {
        onProgress?.(
          renderedCount,
          cards.length,
          `Rendering 300 DPI PNG sheet ${sheetIdx + 1}/${totalSheets} (${renderedCount}/${cards.length} cards)...`
        );
        await yieldToMainThread();
      }
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      sheetCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to encode 300 DPI PNG sheet.'))),
        'image/png'
      );
    });

    if (zip) {
      zip.file(`${safeFileName}-sheet-${String(sheetIdx + 1).padStart(3, '0')}-300dpi.png`, blob);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFileName}-sheet-001-300dpi.png`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  if (zip) {
    onProgress?.(cards.length, cards.length, 'Packaging 300 DPI PNG sheets into ZIP...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName}-${totalSheets}sheets-300dpi-png.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
