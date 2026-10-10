function graphemes(value) {
  if (typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)].map((part) => part.segment);
  }
  return Array.from(value);
}

function characterWidth(character) {
  if (/\p{Mark}/u.test(character)) return 0;
  if (/\p{Extended_Pictographic}/u.test(character) || /[\u0900-\u097f\u2e80-\u9fff]/u.test(character)) return 0.94;
  if (/\s/u.test(character)) return 0.3;
  if (/[ilI.,:;!'|]/u.test(character)) return 0.3;
  if (/[MW@#%&]/u.test(character)) return 0.82;
  if (/\p{Lu}/u.test(character)) return 0.66;
  if (/\p{P}/u.test(character)) return 0.4;
  return 0.54;
}

function fallbackMeasure(text, fontSize) {
  return graphemes(text).reduce((width, character) => width + characterWidth(character), 0) * fontSize;
}

const fitCache = new Map();

function wrapParagraph(paragraph, maxWidth, fontSize, measure) {
  const words = paragraph.trim().split(/\s+/u).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of graphemes(word)) {
      if (line && measure(line + character, fontSize) > maxWidth) {
        lines.push(line);
        line = character;
      } else line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function fitQuoteText(value, {
  width = 720,
  height = 560,
  maxFontSize = 92,
  minFontSize = 22,
  step = 2,
  lineHeight = 1.24,
  measureText = fallbackMeasure,
} = {}) {
  const text = String(value || "").trim();
  const key = JSON.stringify([text, width, height, maxFontSize, minFontSize, step, lineHeight]);
  if (measureText === fallbackMeasure && fitCache.has(key)) return fitCache.get(key);
  const paragraphs = text.split(/\r?\n/u);
  let best = { text, fontSize: minFontSize, lines: paragraphs, height: Infinity };
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= step) {
    const lines = paragraphs.flatMap((paragraph) => wrapParagraph(paragraph, width, fontSize, measureText));
    const measuredHeight = lines.length * fontSize * lineHeight;
    best = { text: lines.join("\n"), fontSize, lines, height: measuredHeight };
    if (measuredHeight <= height) break;
  }
  if (measureText === fallbackMeasure) {
    fitCache.set(key, best);
    if (fitCache.size > 128) fitCache.delete(fitCache.keys().next().value);
  }
  return best;
}