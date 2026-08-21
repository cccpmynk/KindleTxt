import JSZip from 'jszip';

export interface LocalEpubOptions {
  title: string;
  author?: string;
  chapters: { title: string; htmlContent: string }[];
  coverBase64?: string | null;
  fontFamily?: 'default' | 'serif' | 'sans' | 'kaiti';
}

function escapeXmlText(unsafe: string): string {
  return unsafe.replace(/[<>&]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      default: return c;
    }
  });
}

function escapeXmlAttr(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&#39;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function getFontCss(fontFamily: 'default' | 'serif' | 'sans' | 'kaiti' = 'default'): string {
  if (fontFamily === 'serif') {
    return 'font-family: "Songti SC", "SimSun", "STSong", "Songti", serif;';
  } else if (fontFamily === 'sans') {
    return 'font-family: -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;';
  } else if (fontFamily === 'kaiti') {
    return 'font-family: "Kaiti SC", "STKaiti", "KaiTi", "BiauKai", serif;';
  }
  return '';
}

/**
 * Builds standard compliant EPUB 2/3 binary blob directly in browser
 */
export async function buildLocalEpub(options: LocalEpubOptions): Promise<Blob> {
  const zip = new JSZip();
  const title = options.title || 'eReader Ebook';
  const author = options.author || 'eReaderTxt';
  const chapters = options.chapters.length > 0 ? options.chapters : [{ title: '正文', htmlContent: '<p>无正文内容</p>' }];
  const bookId = 'urn:uuid:' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36));

  // 1. mimetype (must be first, uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.folder('META-INF')?.file('container.xml', containerXml);

  const oebps = zip.folder('OEBPS');
  if (!oebps) throw new Error('Failed to create OEBPS folder');

  // 3. Stylesheet
  const fontCss = getFontCss(options.fontFamily);
  const cssContent = `
body {
  margin: 5%;
  text-align: justify;
  ${fontCss}
}
h1, h2, h3 {
  text-align: center;
  font-weight: bold;
  margin: 1.5em 0 1em 0;
}
p {
  text-indent: 2em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  line-height: 1.65;
}
.cover-container {
  text-align: center;
  padding: 0;
  margin: 0;
  height: 100vh;
}
.cover-img {
  max-width: 100%;
  max-height: 100%;
  height: 100vh;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}
`;
  oebps.file('style.css', cssContent);

  // 4. Cover image if provided
  let hasCover = false;
  let coverMediaType = 'image/jpeg';
  if (options.coverBase64) {
    try {
      const match = options.coverBase64.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
      if (match) {
        coverMediaType = match[1];
        const base64Data = match[2];
        oebps.file('cover.image', base64Data, { base64: true });
        hasCover = true;

        const coverHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body class="cover-container">
  <img src="cover.image" alt="Cover" class="cover-img"/>
</body>
</html>`;
        oebps.file('cover.xhtml', coverHtml);
      }
    } catch (e) {
      console.warn('Failed to process cover image:', e);
    }
  }

  // 5. Chapter XHTML files
  chapters.forEach((ch, idx) => {
    const chapterId = `chapter_${idx + 1}`;
    const chapterHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXmlText(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h2>${escapeXmlText(ch.title)}</h2>
  ${ch.htmlContent}
</body>
</html>`;
    oebps.file(`${chapterId}.xhtml`, chapterHtml);
  });

  // 6. NCX (Table of Contents for older readers / EPUB 2)
  let ncxNavPoints = '';
  let playOrder = 1;

  if (hasCover) {
    ncxNavPoints += `
    <navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>封面</text></navLabel>
      <content src="cover.xhtml"/>
    </navPoint>`;
    playOrder++;
  }

  chapters.forEach((ch, idx) => {
    ncxNavPoints += `
    <navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>${escapeXmlText(ch.title)}</text></navLabel>
      <content src="chapter_${idx + 1}.xhtml"/>
    </navPoint>`;
    playOrder++;
  });

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXmlAttr(bookId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXmlText(title)}</text></docTitle>
  <docAuthor><text>${escapeXmlText(author)}</text></docAuthor>
  <navMap>
    ${ncxNavPoints}
  </navMap>
</ncx>`;
  oebps.file('toc.ncx', tocNcx);

  // 7. Nav (EPUB 3 Table of Contents)
  const navList = chapters.map((ch, idx) => `      <li><a href="chapter_${idx + 1}.xhtml">${escapeXmlText(ch.title)}</a></li>`).join('\n');
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>目录</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
${navList}
    </ol>
  </nav>
</body>
</html>`;
  oebps.file('nav.xhtml', navXhtml);

  // 8. content.opf (Package Document)
  let manifestItems = `
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`;

  if (hasCover) {
    manifestItems += `
    <item id="cover-image" href="cover.image" media-type="${coverMediaType}" properties="cover-image"/>
    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
  }

  chapters.forEach((_, idx) => {
    manifestItems += `
    <item id="ch_${idx + 1}" href="chapter_${idx + 1}.xhtml" media-type="application/xhtml+xml"/>`;
  });

  let spineItems = '';
  if (hasCover) {
    spineItems += `\n    <itemref idref="cover-page"/>`;
  }
  spineItems += `\n    <itemref idref="nav"/>`;
  chapters.forEach((_, idx) => {
    spineItems += `\n    <itemref idref="ch_${idx + 1}"/>`;
  });

  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">${escapeXmlText(bookId)}</dc:identifier>
    <dc:title>${escapeXmlText(title)}</dc:title>
    <dc:creator>${escapeXmlText(author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z')}</meta>
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="toc">
    ${spineItems}
  </spine>
  <guide>
    ${hasCover ? '<reference type="cover" title="Cover" href="cover.xhtml"/>' : ''}
    <reference type="toc" title="Table of Contents" href="nav.xhtml"/>
  </guide>
</package>`;
  oebps.file('content.opf', contentOpf);

  // Generate binary blob
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

/**
 * Parses raw text into chapter array with HTML paragraph formatting
 */
export function extractChapters(text: string): { title: string; htmlContent: string }[] {
  const lines = text.split(/\r?\n/);
  const chapters: { title: string; htmlContent: string }[] = [];

  let currentTitle = '开始';
  let currentParagraphs: string[] = [];

  const chapterRegex = /^\s*(第[0-9一二三四五六七八九十百千万]+[章节回卷集部篇幕节]|Chapter\s+[0-9]+|引子|序[言章]?|后记|尾声|楔子|番外|Content\s+[0-9]+).*/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (chapterRegex.test(line) && line.length < 50) {
      if (currentParagraphs.length > 0) {
        chapters.push({
          title: currentTitle,
          htmlContent: currentParagraphs.map(p => `<p>${escapeXmlText(p)}</p>`).join('\n')
        });
        currentParagraphs = [];
      }
      currentTitle = line;
    } else {
      currentParagraphs.push(line);
    }
  }

  if (currentParagraphs.length > 0 || chapters.length === 0) {
    chapters.push({
      title: currentTitle,
      htmlContent: currentParagraphs.length > 0 ? currentParagraphs.map(p => `<p>${escapeXmlText(p)}</p>`).join('\n') : '<p>无正文</p>'
    });
  }

  return chapters;
}

/**
 * Sanitizes known mojibake artifacts caused by Latin-1 / GBK mismatch
 */
export function sanitizeMojibake(text: string): string {
  if (!text) return text;
  return text
    .replace(/¡®/g, '‘')
    .replace(/¡¯/g, '’')
    .replace(/¡°/g, '“')
    .replace(/¡±/g, '”')
    .replace(/¡£/g, '。')
    .replace(/¡¢/g, '、')
    .replace(/¡ª/g, '—')
    .replace(/£¬/g, '，')
    .replace(/£º/g, '：')
    .replace(/£»/g, '；')
    .replace(/£¿/g, '？')
    .replace(/£¡/g, '！')
    .replace(/¡¡/g, '　');
}

/**
 * Decodes uint8Array buffer using robust multi-pass encoding detection
 */
export function decodeBufferToText(
  uint8Array: Uint8Array,
  jschardetInstance: any,
  forcedEncoding?: string
): string {
  // If user explicitly chose an encoding
  if (forcedEncoding && forcedEncoding !== 'auto') {
    try {
      const decoder = new TextDecoder(forcedEncoding);
      return sanitizeMojibake(decoder.decode(uint8Array));
    } catch (e) {
      console.warn(`Forced encoding ${forcedEncoding} failed, falling back to auto`, e);
    }
  }

  // 1. Check Unicode BOMs
  if (uint8Array.length >= 3 && uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
    return sanitizeMojibake(new TextDecoder('utf-8').decode(uint8Array.subarray(3)));
  }
  if (uint8Array.length >= 2 && uint8Array[0] === 0xFF && uint8Array[1] === 0xFE) {
    return sanitizeMojibake(new TextDecoder('utf-16le').decode(uint8Array.subarray(2)));
  }
  if (uint8Array.length >= 2 && uint8Array[0] === 0xFE && uint8Array[1] === 0xFF) {
    return sanitizeMojibake(new TextDecoder('utf-16be').decode(uint8Array.subarray(2)));
  }

  // 2. Strict UTF-8 validation (if buffer conforms to UTF-8 without byte errors, use it directly)
  try {
    const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
    const decoded = strictUtf8.decode(uint8Array);
    return sanitizeMojibake(decoded);
  } catch {
    // Not valid UTF-8, proceed to GB18030 / Big5 / ANSI detection
  }

  // 3. Test GB18030 (standard for all simplified Chinese ANSI text)
  let gb18030Text = '';
  let gbCjkCount = 0;
  try {
    gb18030Text = new TextDecoder('gb18030').decode(uint8Array);
    const cjkMatches = gb18030Text.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\u2018-\u201f]/g);
    gbCjkCount = cjkMatches ? cjkMatches.length : 0;
  } catch {
    gbCjkCount = -1;
  }

  // If GB18030 yielded valid CJK characters or Chinese punctuation, it is almost certainly GB18030/GBK
  if (gbCjkCount > 0) {
    // Check if Big5 is more likely (e.g. jschardet strongly votes Big5)
    try {
      const sample = uint8Array.slice(0, Math.min(uint8Array.length, 50000));
      let binaryStr = '';
      for (let i = 0; i < sample.length; i += 4096) {
        binaryStr += String.fromCharCode.apply(null, Array.from(sample.slice(i, i + 4096)));
      }
      const detected = jschardetInstance.detect(binaryStr);
      if (detected && detected.encoding && detected.encoding.toLowerCase().includes('big5') && detected.confidence > 0.85) {
        const big5Text = new TextDecoder('big5').decode(uint8Array);
        return sanitizeMojibake(big5Text);
      }
    } catch {
      // ignore
    }
    return sanitizeMojibake(gb18030Text);
  }

  // 4. If no CJK was detected in GB18030, consult jschardet for Western European or other encodings
  let detectedEncoding = 'gb18030';
  try {
    const sampleSize = Math.min(uint8Array.length, 100000);
    const sample = uint8Array.slice(0, sampleSize);
    let binaryStr = '';
    for (let i = 0; i < sample.length; i += 4096) {
      binaryStr += String.fromCharCode.apply(null, Array.from(sample.slice(i, i + 4096)));
    }
    const detected = jschardetInstance.detect(binaryStr);
    if (detected && detected.encoding) {
      const enc = detected.encoding.toLowerCase();
      if (enc.includes('gb') || enc.includes('cp936') || enc.includes('gb2312') || enc.includes('gbk')) {
        detectedEncoding = 'gb18030';
      } else if (enc.includes('big5')) {
        detectedEncoding = 'big5';
      } else if (enc.includes('shift_jis') || enc.includes('sjis')) {
        detectedEncoding = 'shift_jis';
      } else if (enc.includes('euc-kr')) {
        detectedEncoding = 'euc-kr';
      } else if (enc.includes('windows-1252') || enc.includes('iso-8859')) {
        detectedEncoding = 'windows-1252';
      }
    }
  } catch (e) {
    console.warn('Fallback detection error', e);
  }

  try {
    const decoder = new TextDecoder(detectedEncoding);
    return sanitizeMojibake(decoder.decode(uint8Array));
  } catch {
    return sanitizeMojibake(gb18030Text || new TextDecoder('utf-8').decode(uint8Array));
  }
}
