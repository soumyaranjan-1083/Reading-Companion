import { createElement, lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion as Motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Check, Dice5, Download, Image as ImageIcon, Share2, X as XIcon } from "lucide-react";
import { GEM_TEMPLATES, loadGemTemplateFonts, templateById } from "./gemTemplates/index.js";
import { ASPECT_SIZES } from "./gemTemplates/aspect.js";
import { fitQuoteText } from "./gemTemplates/quoteFit.js";
import { GEM_PALETTES, gemPaletteById } from "./gemTemplates/palettes.js";
import { loadGemCardPreferences, saveGemCardPreferences } from "./gemTemplates/preferences.js";
import "./GemStoryCard.css";

const lazyTemplates = new Map();
const previewCache = new Map();
const exportCache = new Map();
const CACHE_LIMIT = 5;

function CardTemplate({ templateId, data, options }) {
  const template = templateById(templateId);
  if (!lazyTemplates.has(template.id)) lazyTemplates.set(template.id, lazy(template.load));
  return createElement(lazyTemplates.get(template.id), { data, options });
}

function keepRecent(cache, key, value, limit = CACHE_LIMIT) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value);
}

function waitFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

export default function GemStoryCard({ gem, author, userInitials = "RC", onClose }) {
  const cardRef = useRef(null);
  const [preferences, setPreferences] = useState(loadGemCardPreferences);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [scale, setScale] = useState(0.3);
  const [failedImage, setFailedImage] = useState("");
  const [templatesReady, setTemplatesReady] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const { template: templateId, palette: paletteId, showArtwork } = preferences;
  const selectedTemplate = templateById(templateId);
  const palette = gemPaletteById(paletteId);
  const aspect = "9:16";
  const dimensions = ASPECT_SIZES[aspect];
  const quote = String(gem?.quote || "").trim();
  const image = gem?.sketch && typeof gem.sketch === "object" ? gem.sketch.dataUrl : null;
  const imageFailed = Boolean(image && failedImage === image);
  const hasChapter = Number.isFinite(Number(gem?.chapterNumber));
  const savedAt = new Date(gem?.createdAt || "");
  const savedAtLabel = Number.isNaN(savedAt.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(savedAt);
  const fileName = `${(gem?.bookTitle || "gem").replace(/\s+/g, "-").toLowerCase()}-story.png`;
  const imageKey = image ? `${image.length}:${image.slice(0, 40)}:${image.slice(Math.floor(image.length * 0.25), Math.floor(image.length * 0.25) + 16)}:${image.slice(Math.floor(image.length * 0.5), Math.floor(image.length * 0.5) + 16)}:${image.slice(-24)}` : "";
  const renderKey = JSON.stringify([gem?.id, templateId, paletteId, showArtwork, aspect, quote, gem?.bookTitle, author, gem?.chapterNumber, savedAtLabel, imageKey, imageFailed]);
  const previewUrl = previewCache.get(renderKey);
  const previewRaster = previewUrl ? { key: renderKey, url: previewUrl } : previewResult?.key === renderKey ? previewResult : null;
  const data = {
    quote,
    bookTitle: gem?.bookTitle || "A saved gem",
    author,
    chapter: hasChapter ? gem.chapterNumber : null,
    savedAt: savedAtLabel,
    backgroundImage: image,
    showArtwork,
    supportsPhoto: selectedTemplate.supportsPhoto,
    userInitials,
    imageFailed,
    onImageError: () => setFailedImage(image || ""),
  };
  const summitBaseSize = quote.length < 60 ? 92 : quote.length < 110 ? 80 : quote.length < 180 ? 68 : 60;
  const summitFit = fitQuoteText(quote, {
    width: 840,
    height: 660,
    maxFontSize: summitBaseSize,
    minFontSize: 56,
  });
  const options = {
    accent: palette.accent,
    palette,
    showArtwork,
    effectId: paletteId,
    aspect,
    height: dimensions.height,
    fitFontSize: summitFit.fontSize,
    fitText: summitFit.text,
    cardRef,
  };

  useEffect(() => {
    saveGemCardPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("./gemTemplates/templates.css"),
      ...GEM_TEMPLATES.map(async (template) => {
        await template.load();
        await loadGemTemplateFonts(template);
      }),
    ]).then(() => {
      if (!cancelled) setTemplatesReady(true);
    }).catch(() => {
      if (!cancelled) setTemplatesReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const fit = () => {
      const availableWidth = window.innerWidth - 32;
      const availableHeight = Math.max(120, window.innerHeight - Math.min(window.innerHeight * 0.44, 380) - 70);
      setScale(Math.max(0.1, Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [aspect, dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!templatesReady) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        await loadGemTemplateFonts(selectedTemplate, quote);
        await waitFrame();
        await waitFrame();
        if (cancelled || !cardRef.current) return;
        const url = await toPng(cardRef.current, { width: dimensions.width, height: dimensions.height, pixelRatio: 0.36, cacheBust: true });
        if (cancelled) return;
        keepRecent(previewCache, renderKey, url);
        setPreviewResult({ key: renderKey, url });
      } catch {
        if (!cancelled) setPreviewResult(null);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [dimensions.height, dimensions.width, paletteId, quote, renderKey, selectedTemplate, showArtwork, templatesReady, templateId]);

  function flash(text) {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2200);
  }

  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function surpriseMe() {
    const template = GEM_TEMPLATES[Math.floor(Math.random() * GEM_TEMPLATES.length)];
    const palette = GEM_PALETTES[Math.floor(Math.random() * GEM_PALETTES.length)];
    setPreferences((current) => ({ ...current, template: template.id, palette: palette.id, showArtwork: template.supportsPhoto }));
  }

  async function renderExport() {
    if (exportCache.has(renderKey)) return exportCache.get(renderKey);
    await loadGemTemplateFonts(selectedTemplate, quote);
    await document.fonts.ready;
    const base = { width: dimensions.width, height: dimensions.height, cacheBust: true, backgroundColor: "#07070b" };
    const url = await toPng(cardRef.current, { ...base, pixelRatio: 1 });
    keepRecent(exportCache, renderKey, url, 2);
    return url;
  }

  function saveFile(url) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  }

  async function download() {
    setBusy(true);
    try { saveFile(await renderExport()); flash("Saved to your device"); }
    catch { flash("Could not create the image"); }
    finally { setBusy(false); }
  }

  async function share() {
    setBusy(true);
    try {
      const url = await renderExport();
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({
        files: [file],
        title: gem?.bookTitle || "Reading Companion",
        text: `${gem?.bookTitle || "A saved gem"}${author && author !== "Author unknown" ? ` by ${author}` : ""} · Reading Companion ${window.location.origin}`,
      });
      else { saveFile(url); flash("Sharing not supported here - saved instead"); }
    } catch (error) {
      if (error?.name !== "AbortError") flash("Could not create the image");
    } finally { setBusy(false); }
  }

  return createPortal(
    <Motion.div className="gsc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <div className="gsc-stage" style={{ width: dimensions.width * scale, height: dimensions.height * scale }}>
        <div className="gsc-scale" style={{ width: dimensions.width, height: dimensions.height, transform: `scale(${scale})` }}>
          {templatesReady ? <Suspense fallback={<div className="gsc-loading-card" role="status">Loading template…</div>}>
            <CardTemplate templateId={selectedTemplate.id} data={data} options={options} />
          </Suspense> : <div className="gsc-loading-card" role="status">Loading type and artwork…</div>}
          {previewRaster?.key === renderKey && <img className="gsc-preview-raster" src={previewRaster.url} alt="Rendered card preview" />}
        </div>
      </div>

      {msg && <div className="gsc-toast" role="status">{msg}</div>}

      <Motion.div className="gsc-dock" initial={{ y: 90, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}>
        <section className="gsc-template-section" aria-label="Choose gem card template">
          <div className="gsc-picker-heading">
            <div><b>{selectedTemplate.name}</b><span>{selectedTemplate.description}</span></div>
            <button type="button" className="gsc-surprise" onClick={surpriseMe} title="Pick a random template and palette"><Dice5 size={15} /> Surprise me</button>
          </div>
          <div className="gsc-template-strip" role="listbox" aria-label="Gem card templates">
            {GEM_TEMPLATES.map((template) => {
              const miniHeight = Math.round(78 / (dimensions.width / dimensions.height));
              const previewData = { ...data, onImageError: undefined };
              const previewOptions = {
                accent: palette.accent,
                effectId: paletteId,
                palette,
                aspect,
                height: dimensions.height,
                showArtwork,
                supportsPhoto: template.supportsPhoto,
              };
              return (
                <button type="button" role="option" aria-selected={template.id === templateId} className={`gsc-template-choice${template.id === templateId ? " on" : ""}`} key={template.id} onClick={() => updatePreference("template", template.id)} title={template.description}>
                  <span className="gsc-mini-frame" style={{ width: 78, height: miniHeight }}>
                    <span className="gsc-mini-scale" style={{ width: dimensions.width, height: dimensions.height, transform: `scale(${78 / dimensions.width})` }}>
                      {templatesReady ? <Suspense fallback={<span className="gsc-mini-fallback" />}><CardTemplate templateId={template.id} data={previewData} options={previewOptions} /></Suspense> : <span className="gsc-mini-fallback" />}
                    </span>
                    {template.id === templateId && <i className="gsc-selected-check"><Check size={11} /></i>}
                  </span>
                  <span className="gsc-template-name">{template.name}</span>
                </button>
              );
            })}
          </div>
          <div className="gsc-palette-row" role="radiogroup" aria-label="Card palette">
            {GEM_PALETTES.map((item) => <button type="button" key={item.id} role="radio" aria-checked={paletteId === item.id} aria-label={`${item.name} palette`} title={item.name} className={`gsc-palette-swatch${paletteId === item.id ? " on" : ""}`} onClick={() => updatePreference("palette", item.id)} style={{ background: `linear-gradient(145deg, ${item.stops.join(", ")})`, "--swatch-accent": item.accent }}><i /></button>)}
          </div>
        </section>

        <div className="gsc-control-row">
          {selectedTemplate.supportsPhoto && <label className="gsc-artwork-toggle"><input type="checkbox" checked={showArtwork} onChange={(event) => updatePreference("showArtwork", event.target.checked)} /><ImageIcon size={15} /><span>Show artwork</span></label>}

          <div className="gsc-actions">
            <button type="button" className="gsc-btn share" onClick={share} disabled={busy} aria-label="Share card" title="Share"><Share2 size={16} /><span>Share</span></button>
            <button type="button" className="gsc-btn primary" onClick={download} disabled={busy}><Download size={17} /><span>{busy ? "Saving…" : "Download"}</span></button>
            <button type="button" className="gsc-btn icon" onClick={onClose} aria-label="Close" title="Close"><XIcon size={17} /></button>
          </div>
        </div>
      </Motion.div>
    </Motion.div>,
    document.body,
  );
}
