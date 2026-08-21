import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { extractChapters, isChapterHeading, filterWatermarkLines, cleanWatermarkSubstring } from './epubBuilder';

// Set up worker using URL constructor or CDN
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
}

export interface PdfParseResult {
  title: string;
  author: string;
  chapters: { title: string; htmlContent: string }[];
  rawText: string;
  pageCount: number;
  isOcr?: boolean;
}

export interface PdfProgressInfo {
  type: 'extracting' | 'ocr_init' | 'ocr_page';
  current: number;
  total: number;
  message?: string;
  ocrConfidence?: number;
}

interface PdfTextItem {
  str: string;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
  hasEOL?: boolean;
}

/**
 * Intelligent reflow: removes isolated page numbers, watermarks, fixes split lines, and formats into clean paragraphs
 */
function cleanAndReflowPageLines(lines: string[]): string[] {
  const cleaned: string[] = [];
  const pageNumPattern = /^\s*(-?\s*\d+\s*-?|第?\s*\d+\s*页(\s*\/\s*共?\s*\d+\s*页)?|Page\s+\d+(\s+of\s+\d+)?)\s*$/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Apply inline watermark subtraction to remove embedded watermark fragments
    const line = cleanWatermarkSubstring(rawLine);
    if (!line || line.length <= 1) {
      continue;
    }

    // Filter standalone header/footer page numbers
    if (pageNumPattern.test(line) && (i === 0 || i >= lines.length - 2)) {
      continue;
    }

    cleaned.push(line);
  }

  // Reflow lines into logical paragraphs
  const paragraphs: string[] = [];
  let currentP = '';

  for (let i = 0; i < cleaned.length; i++) {
    const line = cleaned[i];
    
    // Check if line looks like a new chapter / section heading
    const isHeading = isChapterHeading(line);
    const endsWithPunctuation = /[。！？!?.…:：”"’'」』）\)]$/.test(line);

    if (isHeading) {
      if (currentP) {
        paragraphs.push(currentP.trim());
        currentP = '';
      }
      paragraphs.push(line);
      continue;
    }

    if (!currentP) {
      currentP = line;
    } else {
      // If previous line did not end with punctuation and current line looks like continuation
      const isEnglish = /[a-zA-Z0-9,]$/.test(currentP);
      if (isEnglish) {
        currentP += ' ' + line;
      } else {
        currentP += line;
      }
    }

    if (endsWithPunctuation) {
      paragraphs.push(currentP.trim());
      currentP = '';
    }
  }

  if (currentP) {
    paragraphs.push(currentP.trim());
  }

  return paragraphs;
}

/**
 * Render a PDF page onto an HTMLCanvasElement
 */
async function renderPageToCanvas(page: any, scale = 1.6): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  if (!context) {
    throw new Error('Canvas 2D context not available');
  }

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  return canvas;
}

/**
 * Clean and remove faint background watermarks from canvas (adaptive threshold binarization)
 */
function cleanCanvasBackgroundWatermarks(canvas: HTMLCanvasElement, threshold = 150) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceptual grayscale calculation
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Faint background watermark pixels are bleached to pure white (#ffffff)
      if (gray > threshold) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else {
        // Enhance text darkness & contrast for crisp OCR recognition
        const enhanced = Math.max(0, Math.floor(gray * 0.7));
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Canvas watermark cleaning skipped:', e);
  }
}

/**
 * Parses PDF array buffer, extracts text & chapters, with smart automatic fallback to OCR for scanned PDFs
 */
export async function parsePdfBuffer(
  arrayBuffer: ArrayBuffer,
  onProgress?: (info: PdfProgressInfo) => void,
  options?: {
    forceOcr?: boolean;
    ocrLang?: 'chi_sim+eng' | 'eng' | 'chi_tra+eng';
    removeWatermark?: boolean;
  }
): Promise<PdfParseResult> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + pdfjsLib.version + '/standard_fonts/',
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // Extract Metadata
  let bookTitle = '';
  let bookAuthor = '';
  try {
    const meta = await pdfDoc.getMetadata();
    if (meta && meta.info) {
      const info = meta.info as any;
      if (info.Title && typeof info.Title === 'string' && info.Title.trim().length > 1) {
        bookTitle = info.Title.trim();
      }
      if (info.Author && typeof info.Author === 'string' && info.Author.trim().length > 1) {
        bookAuthor = info.Author.trim();
      }
    }
  } catch (e) {
    console.warn('Could not read PDF metadata:', e);
  }

  // Extract Outlines (Bookmarks / Table of Contents)
  let outlineItems: any[] = [];
  try {
    const outline = await pdfDoc.getOutline();
    if (outline && Array.isArray(outline) && outline.length > 0) {
      outlineItems = outline;
    }
  } catch (e) {
    console.warn('Could not read PDF outline:', e);
  }

  // If forceOcr is NOT specified, try normal text layer extraction first
  let pageTexts: string[] = [];
  let totalExtractedCharCount = 0;

  if (!options?.forceOcr) {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        onProgress({
          type: 'extracting',
          current: pageNum,
          total: numPages,
          message: `正在提取页面文字 (${pageNum}/${numPages})...`
        });
      }

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as PdfTextItem[];

      const rawLines: string[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const item of items) {
        if (!('str' in item)) continue;
        const str = item.str;
        if (!str) continue;

        const transform = item.transform;
        const y = transform ? transform[5] : null;

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 5) {
          if (currentLine.trim()) {
            rawLines.push(currentLine.trim());
          }
          currentLine = str;
        } else {
          if (currentLine && /[a-zA-Z0-9]/.test(currentLine.slice(-1)) && /[a-zA-Z0-9]/.test(str[0])) {
            currentLine += ' ' + str;
          } else {
            currentLine += str;
          }
        }

        if (y !== null) lastY = y;
      }

      if (currentLine.trim()) {
        rawLines.push(currentLine.trim());
      }

      const reflowedParagraphs = cleanAndReflowPageLines(rawLines);
      const pageReflowText = reflowedParagraphs.join('\n\n');
      totalExtractedCharCount += pageReflowText.replace(/\s+/g, '').length;
      pageTexts.push(pageReflowText);
    }
  }

  // Check if PDF is a scanned/image PDF (very little text extracted relative to page count)
  const isScannedPdf = options?.forceOcr || (totalExtractedCharCount < Math.max(10, numPages * 8));
  let usedOcr = false;

  if (isScannedPdf) {
    usedOcr = true;
    pageTexts = []; // Clear and refill with OCR recognized text

    if (onProgress) {
      onProgress({
        type: 'ocr_init',
        current: 0,
        total: numPages,
        message: '检测到扫描/图片版 PDF，正在初始化本地 OCR 识别引擎...'
      });
    }

    const ocrLang = options?.ocrLang || 'chi_sim+eng';
    let worker: any = null;
    try {
      worker = await createWorker(ocrLang);

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (onProgress) {
          onProgress({
            type: 'ocr_page',
            current: pageNum,
            total: numPages,
            message: `正在本地 OCR 识别第 ${pageNum}/${numPages} 页...`
          });
        }

        const page = await pdfDoc.getPage(pageNum);
        const canvas = await renderPageToCanvas(page, 1.8);
        if (options?.removeWatermark !== false) {
          cleanCanvasBackgroundWatermarks(canvas);
        }
        const result = await worker.recognize(canvas);
        const recognizedText = result.data.text || '';

        const lines = recognizedText.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
        const reflowed = cleanAndReflowPageLines(lines);
        pageTexts.push(reflowed.join('\n\n'));
      }
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.warn('Error terminating OCR worker:', e);
        }
      }
    }
  }

  const fullText = pageTexts.join('\n\n');

  // Build chapters: first try outline/bookmark approach, fallback to regex chapter detector
  let chapters: { title: string; htmlContent: string }[] = [];

  if (outlineItems.length > 0) {
    try {
      const toc: { title: string; pageIndex: number }[] = [];
      for (const item of outlineItems) {
        if (item.title && item.dest) {
          let pageIndex = -1;
          if (typeof item.dest === 'string') {
            const dest = await pdfDoc.getDestination(item.dest);
            if (dest && dest[0]) {
              pageIndex = await pdfDoc.getPageIndex(dest[0]);
            }
          } else if (Array.isArray(item.dest) && item.dest[0]) {
            pageIndex = await pdfDoc.getPageIndex(item.dest[0]);
          }

          if (pageIndex >= 0 && pageIndex < numPages) {
            toc.push({ title: item.title.trim(), pageIndex });
          }
        }
      }

      toc.sort((a, b) => a.pageIndex - b.pageIndex);

      if (toc.length >= 2) {
        for (let i = 0; i < toc.length; i++) {
          const current = toc[i];
          const next = toc[i + 1];
          const start = current.pageIndex;
          const end = next ? next.pageIndex : numPages;

          const chapterPages = pageTexts.slice(start, end);
          const chapterText = chapterPages.join('\n\n');
          const paragraphs = chapterText.split(/\n+/).filter(p => p.trim());

          chapters.push({
            title: current.title,
            htmlContent: paragraphs.length > 0 
              ? paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('\n')
              : '<p>正文为空</p>'
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse outline destinations, using chapter extraction:', e);
    }
  }

  // Fallback if outline didn't produce chapters
  if (chapters.length === 0) {
    chapters = extractChapters(fullText);
  }

  return {
    title: bookTitle,
    author: bookAuthor,
    chapters,
    rawText: fullText,
    pageCount: numPages,
    isOcr: usedOcr
  };
}

function escapeHtml(str: string): string {
  return str.replace(/[<>&]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      default: return c;
    }
  });
}
