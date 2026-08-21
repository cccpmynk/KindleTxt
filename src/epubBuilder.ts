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
  line-height: 1.75;
  ${fontCss}
}
h1, h2, h3 {
  text-align: center;
  font-weight: 600;
  margin: 1.8em 0 1.2em 0;
  line-height: 1.4;
  page-break-inside: avoid;
}
h2 {
  font-size: 1.4em;
  padding-bottom: 0.3em;
}
p {
  text-indent: 2em;
  margin-top: 0.6em;
  margin-bottom: 0.6em;
  line-height: 1.75;
  word-break: break-word;
}
.toc-title {
  text-align: center;
  font-size: 1.6em;
  margin-bottom: 1.5em;
  letter-spacing: 0.2em;
}
ol.toc-list {
  list-style: none;
  padding: 0;
  margin: 0 auto;
  max-width: 90%;
}
ol.toc-list li {
  margin: 0.7em 0;
  padding: 0.3em 0;
  border-bottom: 1px dashed rgba(128, 128, 128, 0.25);
}
ol.toc-list li a {
  text-decoration: none;
  color: inherit;
  display: block;
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
  let coverFileName = 'cover.jpg';
  if (options.coverBase64) {
    try {
      const match = options.coverBase64.match(/^data:(image\/[a-zA-Z0-9\+\-\.]+);base64,(.+)$/);
      if (match) {
        coverMediaType = match[1];
        const base64Data = match[2];
        const ext = coverMediaType.toLowerCase().includes('png') ? 'png' : 'jpg';
        coverFileName = `cover.${ext}`;
        
        oebps.file(coverFileName, base64Data, { base64: true });
        hasCover = true;

        const coverHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Cover</title>
  <meta name="viewport" content="width=600, height=800"/>
  <link rel="stylesheet" type="text/css" href="style.css"/>
  <style type="text/css">
    @page { margin: 0; padding: 0; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; text-align: center; background-color: #ffffff; }
    .cover-wrapper { margin: 0; padding: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="cover-wrapper">
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid meet">
      <image width="600" height="800" xlink:href="${coverFileName}"/>
    </svg>
  </div>
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
    <h1 class="toc-title">目 录</h1>
    <ol class="toc-list">
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
    <item id="cover-image" href="${coverFileName}" media-type="${coverMediaType}" properties="cover-image"/>
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
    ${hasCover ? `<meta name="cover" content="cover-image"/>` : ''}
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
 * Comprehensive chapter heading matching rules
 */
const CHAPTER_PATTERNS = [
  // 经典中文格式：第x章、第x回、第x节、第x卷、第x部、第x篇、第x幕、第x集、第x分卷等
  /^\s*(第\s*[0-9一二三四五六七八九十百千万零〇两]+\s*[章节回卷集部篇幕节分卷册款项])(\s*[:：、\s]\s*.*)?$/i,
  // 纯中文章节：卷一、篇二、分卷一等
  /^\s*([卷篇部分卷册]\s*[0-9一二三四五六七八九十百千万零〇两]+)(\s*[:：、\s]\s*.*)?$/i,
  // 英文格式：Chapter 1, Section 2, Part 3, Volume 4, Book 1, Act 1, Scene 1
  /^\s*((?:Chapter|Section|Part|Volume|Vol\.|Book|Act|Scene)\s*[0-9ivxlcdm]+)(\s*[:：\-\.]\s*.*)?$/i,
  // 特殊结构章节标识：引子、序言、序章、后记、尾声、楔子、番外、前言、附录、结语、结案、终章、插曲
  /^\s*(引子|序[言章幕]?|前言|自序|后记|尾声|结语|结案|终章|楔子|番外(?:\s*\d+)?|附录(?:\s*[0-9一二三四五六七八九十A-Za-z]+)?|写在前面|致谢|插曲|Content\s+[0-9]+)(\s*[:：、\s\-].*)?$/i,
  // 纯数字或罗马数字独立标题（带点或顿号或括号）：1. / 1、 / (1) / 【1】 / 一、 / 第一、 后面跟着标题
  /^\s*(?:[【（(]?\s*(?:[0-9]{1,4}|[一二三四五六七八九十]{1,3})\s*[】）)]?[\.、\s\-—]+)[^\r\n]{1,35}$/i,
];

/**
 * Check if a line matches standard chapter heading rules
 */
export function isChapterHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return false;
  
  // Exclude lines that are clearly ordinary sentences (ending with sentence-ending punctuation or too long)
  if (/[。！？!?…]$/.test(trimmed)) return false;

  for (const pattern of CHAPTER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  return false;
}

/**
 * In-line Substring Subtraction & Watermark Purifier
 * Performs a subtraction pass over line/paragraph text to eradicate embedded watermark fragments
 */
export function cleanWatermarkSubstring(text: string): string {
  if (!text) return "";
  let cleaned = text;

  // 1. Watermark phrase patterns (including spaced characters like "未 经 许 可", "严 禁 篡 改")
  const phrasePatterns = [
    // 警示语及其变体（包含字间空格、错字与标点）
    // 专门针对被 OCR 错位交织的复合乱码水印，例如："严禁篡禁篡改C20260 许可0053330 严禁"
    /[严禁篡改未经许可内部机密仅供参考不得外传受控文件C0-9\s]{12,}/g,
    /未\s*经\s*许\s*可[，,\s]*严\s*禁\s*篡\s*改/gi,
    /未\s*经\s*许\s*可/gi,
    /严\s*禁\s*篡\s*改/gi,
    /严\s*禁\s*篡\s*禁\s*篡\s*改/gi,
    /未\s*禁\s*篡\s*改/gi,
    /未\s*经\s*授\s*权/gi,
    /严\s*禁\s*复\s*制/gi,
    /内\s*部\s*机\s*密/gi,
    /机\s*密\s*文\s*件/gi,
    /仅\s*供\s*内\s*部\s*参\s*考/gi,
    /不\s*得\s*外\s*传/gi,
    /受\s*控\s*文\s*件/gi,
    /版\s*权\s*所\s*有/gi,
    /CONFIDENTIAL/gi,
    /INTERNAL\s+USE\s+ONLY/gi,
    /STRICTLY\s+CONFIDENTIAL/gi,
    /DO\s+NOT\s+DISTRIBUTE/gi,
    /WATERMARK/gi,
    // 常见小说网站与盗版推广标识
    /(?:笔趣阁|顶点小说|飘天文学|八零电子书|久久小说|落霞小说|69书吧|爱下书|书旗网|飞卢小说|晋江文学|起点中文网)/gi,
    /(?:最新最快TXT小说下载|TXT小说下载|电子书下载|永久免费|免费小说网|小说免费阅读)/gi,
    /(?:欢迎访问|本站所有资源|版权归原作者所有|转载请保留|手机访问|扫码关注)/gi,
    /(?:关注微信公众号|微信号[:：]|QQ群[:：]|官方群[:：])/gi,
    /(?:请支持正版|求月票|求推荐票|求收藏|求订阅|打赏)/gi,
    /(?:ereadertxt|ereader\s*txt)/gi,
    // 网络 URL
    /https?:\/\/[^\s]+/gi,
    /www\.[a-z0-9\-_]+\.[a-z0-9]+/gi,
    // MAC 地址或设备 ID
    /(?:[0-9A-Fa-f]{2}[:-]){4,7}[0-9A-Fa-f]{2}/g,
    // 追踪流水工号模式（以 C 或字母开头接 8~25 位数字，或者连续 10~25 位流水数字，如 C202607150053330 / 2607150053330）
    /[A-Za-z]?[0-9]{8,25}/g,
  ];

  for (const pattern of phrasePatterns) {
    cleaned = cleaned.replace(pattern, " ");
  }

  // 2. 标点与格式平复：清理由于扣减水印残留的悬挂符号或连续多余空白
  cleaned = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/^\s*[,，、:：;；\-—\.]+\s*/g, "") // 清理开头残留标点
    .replace(/\s*[,，、\-—]+\s*$/g, "") // 清理末尾孤立无意义连接标点
    .trim();

  return cleaned;
}

/**
 * Filter unwanted watermarks, website promotions, and junk lines
 */
export function filterWatermarkLines(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  const cleaned = cleanWatermarkSubstring(trimmed);
  if (!cleaned || cleaned.length <= 1) {
    return false; // filtered out
  }

  return true;
}

/**
 * Parses raw text into chapter array with HTML paragraph formatting
 */
export function extractChapters(text: string): { title: string; htmlContent: string }[] {
  const lines = text.split(/\r?\n/);
  const chapters: { title: string; htmlContent: string }[] = [];

  let currentTitle = '';
  let currentParagraphs: string[] = [];
  let hasFoundFirstChapter = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Apply inline watermark subtraction to remove embedded watermark fragments
    const cleanedLine = cleanWatermarkSubstring(line);
    if (!cleanedLine || cleanedLine.length <= 1) {
      continue;
    }

    if (isChapterHeading(cleanedLine)) {
      if (currentParagraphs.length > 0) {
        chapters.push({
          title: currentTitle || (hasFoundFirstChapter ? '章节' : '前言 / 序'),
          htmlContent: currentParagraphs.map(p => `<p>${escapeXmlText(p)}</p>`).join('\n')
        });
        currentParagraphs = [];
      }
      currentTitle = cleanedLine;
      hasFoundFirstChapter = true;
    } else {
      currentParagraphs.push(cleanedLine);
    }
  }

  if (currentParagraphs.length > 0 || chapters.length === 0) {
    chapters.push({
      title: currentTitle || (chapters.length === 0 ? '正文' : '结语 / 后记'),
      htmlContent: currentParagraphs.length > 0 ? currentParagraphs.map(p => `<p>${escapeXmlText(p)}</p>`).join('\n') : '<p>无正文</p>'
    });
  }

  return chapters.map(ch => ({
    title: ch.title.replace(/\s+/g, ' ').trim(),
    htmlContent: ch.htmlContent
  }));
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
