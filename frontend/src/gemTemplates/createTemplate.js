import { createElement } from "react";
import TemplateCanvas from "./TemplateCanvas.js";

export function createTemplate(metadata, fonts) {
  const templateMetadata = { ...metadata, fonts: [...new Set([...metadata.fonts, "Noto Sans Devanagari"])] };
  function render(context, data, options) {
    const element = context?.createElement || createElement;
    return element(TemplateCanvas, { templateId: templateMetadata.id, data, options, fonts, effectId: options.effectId });
  }
  function Component({ data, options }) {
    return render(null, data, options);
  }
  return { ...templateMetadata, render, Component };
}