import { createElement, lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Check, ChevronUp, Dice5, Download, Share2, X as XIcon } from "lucide-react";
import { useBackLayer } from "./backStack.js";
import { GEM_TEMPLATES, loadGemTemplateFonts, templateById } from "./gemTemplates/index.js";
import { ASPECT_SIZES } from "./gemTemplates/aspect.js";
import { fitQuoteText } from "./gemTemplates/quoteFit.js";
import { loadGemCardPreferences, saveGemCardPreferences } from "./gemTemplates/preferences.js";
import "./GemStoryCard.css";

const EFFECTS = [
  { id: "noir", label: "Noir", swatch: "linear-gradient(135deg,#f2c48d,#1a1410)", accent: "#f2c48d" },
  { id: "aurora", label: "Aurora", swatch: "linear-gradient(135deg,#8B5CF6,#22D3EE)", accent: "#c4b5fd" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(135deg,#fb923c,#e11d48)", accent: "#fdba74" },
  { id: "ocean", label: "Ocean", swatch: "linear-gradient(135deg,#22d3ee,#1d4ed8)", accent: "#67e8f9" },
  { id: "forest", label: "Forest", swatch: "linear-gradient(135deg,#86efac,#047857)", accent: "#86efac" },
  { id: "rose", label: "Rose", swatch: "linear-gradient(135deg,#fda4af,#7c3aed)", accent: "#fda4af" },
  { id: "mono", label: "Mono", swatch: "linear-gradient(135deg,#ffffff,#111111)", accent: "#ffffff" },
  { id: "vintage", label: "Vintage", swatch: "linear-gradient(135deg,#e7c9a0,#6b4423)", accent: "#e7c9a0" },
  { id: "neon", label: "Neon", swatch: "linear-gradient(135deg,#e879f9,#22d3ee)", accent: "#e879f9" },
];
const ASPECTS = Object.entries(ASPECT_SIZES).map(([id, value]) => ({ id, ...value }));
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
  const effectButtonRef = useRef(null);
  const [preferences, setPreferences] = useState(loadGemCardPreferences);
  const [effectOpen, setEffectOpen] = useState(false);
  const [effectMenuPosition, setEffectMenuPosition] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [scale, setScale] = useState(0.3);
  const [failedImage, setFailedImage] = useState("");
  const [templatesReady, setTemplatesReady] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  useBackLayer(effectOpen, () => setEffectOpen(false));

  const { template: templateId, accent: effectId, aspect } = preferences;
  const selectedTemplate = templateById(templateId);
  const currentEffect = EFFECTS.find((item) => item.id === effectId) || EFFECTS[0];
  const dimensions = ASPECT_SIZES[aspect] || ASPECT_SIZES["9:16"];
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
  const renderKey = JSON.stringify([gem?.id, templateId, effectId, aspect, quote, gem?.bookTitle, author, gem?.chapterNumber, savedAtLabel, imageKey, imageFailed]);
  const previewUrl = previewCache.get(renderKey);
  const previewRaster = previewUrl ? { key: renderKey, url: previewUrl } : previewResult?.key === renderKey ? previewResult : null;
  const data = {
    quote,
    bookTitle: gem?.bookTitle || "A saved gem",
    author,
    chapter: hasChapter ? gem.chapterNumber : null,
    savedAt: savedAtLabel,
    backgroundImage: image,
    userInitials,
    imageFailed,
    onImageError: () => setFailedImage(image || ""),
  };
  const summitBaseSize = quote.length < 60 ? 92 : quote.length < 110 ? 80 : quote.length < 180 ? 68 : quote.length < 260 ? 58 : 50;
  const summitFit = fitQuoteText(quote, {
    width: 840,
    height: aspect === "1:1" ? 340 : aspect === "4:5" ? 490 : 660,
    maxFontSize: summitBaseSize,
    minFontSize: 26,
  });
  const options = {
    accent: selectedTemplate.supportsEffect === false ? selectedTemplate.defaultAccent : currentEffect.accent,
    effectId,
    aspect,
    height: dimensions.height,
    fitFontSize: summitFit.fontSize,
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
  }, [dimensions.height, dimensions.width, effectId, quote, renderKey, selectedTemplate, templatesReady, templateId]);

  function flash(text) {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2200);
  }

  function updatePreference(key, value) {
    if (key === "template") setEffectOpen(false);
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  function toggleEffectMenu() {
    if (effectOpen) {
      setEffectOpen(false);
      return;
    }
    const bounds = effectButtonRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setEffectMenuPosition({ left: Math.max(10, Math.min(bounds.left, window.innerWidth - 220)), bottom: window.innerHeight - bounds.top + 8 });
    setEffectOpen(true);
  }

  function surpriseMe() {
    const template = GEM_TEMPLATES[Math.floor(Math.random() * GEM_TEMPLATES.length)];
    const effect = EFFECTS[Math.floor(Math.random() * EFFECTS.length)];
    setPreferences((current) => ({ ...current, template: template.id, accent: effect.id }));
  }

  async function renderExport() {
    if (exportCache.has(renderKey)) return exportCache.get(renderKey);
    await loadGemTemplateFonts(selectedTemplate, quote);
    await document.fonts.ready;
    const base = { width: dimensions.width, height: dimensions.height, cacheBust: true, backgroundColor: "#07070b" };
    const opts = { ...base, pixelRatio: 1 };
    await toPng(cardRef.current, opts);
    const url = await toPng(cardRef.current, opts);
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
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: gem?.bookTitle || "Gem" });
      else { saveFile(url); flash("Sharing not supported here - saved instead"); }
    } catch (error) {
      if (error?.name !== "AbortError") flash("Could not create the image");
    } finally { setBusy(false); }
  }

  return createPortal(
    <Motion.div className="gsc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <div className="gsc-stage" style={{ width: dimensions.width * scale, height: dimensions.height * scale }}>
        <div className="gsc-scale" style={{ width: dimensions.width, height: dimensions.height, transform: `scale(${scale})` }}>
          <Suspense fallback={<div className="gsc-loading-card" role="status">Loading template…</div>}>
            <CardTemplate templateId={selectedTemplate.id} data={data} options={options} />
          </Suspense>
          {previewRaster?.key === renderKey && <img className="gsc-preview-raster" src={previewRaster.url} alt="Rendered card preview" />}
        </div>
      </div>

      {msg && <div className="gsc-toast" role="status">{msg}</div>}

      <Motion.div className="gsc-dock" initial={{ y: 90, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}>
        <section className="gsc-template-section" aria-label="Choose gem card template">
          <div className="gsc-picker-heading">
            <div><b>Template</b><span>{selectedTemplate.description}</span></div>
            <button type="button" className="gsc-surprise" onClick={surpriseMe} title="Pick a random template and color effect"><Dice5 size={15} /> Surprise me</button>
          </div>
          <div className="gsc-template-strip" role="listbox" aria-label="Gem card templates">
            {GEM_TEMPLATES.map((template) => {
              const miniHeight = Math.round(78 / (dimensions.width / dimensions.height));
              const previewData = { ...data, onImageError: undefined };
              const previewOptions = {
                accent: template.supportsEffect === false ? template.defaultAccent : currentEffect.accent,
                effectId,
                aspect,
                height: dimensions.height,
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
        </section>

        <div className="gsc-control-row">
          <div className="gsc-control-group">
            <span className="gsc-control-label">Color effect</span>
            <div className="gsc-menu-wrap">
              <button ref={effectButtonRef} type="button" className="gsc-btn gsc-effect-btn" onClick={toggleEffectMenu} disabled={selectedTemplate.supportsEffect === false} title={selectedTemplate.supportsEffect === false ? "Neon Terminal uses its fixed cyan and green palette" : "Change the template accent color"}>
                <span className="gsc-swatch" style={{ background: selectedTemplate.supportsEffect === false ? selectedTemplate.defaultAccent : currentEffect.swatch }} />
                <span>{selectedTemplate.supportsEffect === false ? "Fixed" : currentEffect.label}</span>
                <ChevronUp size={14} style={{ transform: effectOpen ? "rotate(180deg)" : "none" }} />
              </button>
            </div>
          </div>

          <div className="gsc-control-group">
            <span className="gsc-control-label">Aspect ratio</span>
            <div className="gsc-aspect-toggle" role="group" aria-label="Export aspect ratio">
              {ASPECTS.map((item) => <button type="button" key={item.id} className={aspect === item.id ? "on" : ""} aria-label={`${item.label}, ${item.id}`} aria-pressed={aspect === item.id} onClick={() => updatePreference("aspect", item.id)}><b>{item.label}</b><small>{item.id}</small></button>)}
            </div>
          </div>

          <div className="gsc-actions">
            <button type="button" className="gsc-btn icon" onClick={share} disabled={busy} aria-label="Share card" title="Share"><Share2 size={17} /></button>
            <button type="button" className="gsc-btn primary" onClick={download} disabled={busy}><Download size={17} /><span>{busy ? "Saving…" : "Download"}</span></button>
            <button type="button" className="gsc-btn icon" onClick={onClose} aria-label="Close" title="Close"><XIcon size={17} /></button>
          </div>
        </div>
      </Motion.div>
      {createPortal(
        <AnimatePresence>
          {effectOpen && selectedTemplate.supportsEffect !== false && effectMenuPosition && (
            <Motion.div className="gsc-menu gsc-effect-menu" style={effectMenuPosition} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.16 }}>
              {EFFECTS.map((effect) => (
                <button type="button" key={effect.id} className={`gsc-opt ${effect.id === effectId ? "on" : ""}`} onClick={() => { updatePreference("accent", effect.id); setEffectOpen(false); }}>
                  <span className="gsc-swatch" style={{ background: effect.swatch }} /><span className="gsc-opt-label">{effect.label}</span>{effect.id === effectId && <Check size={15} />}
                </button>
              ))}
            </Motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Motion.div>,
    document.body,
  );
}
