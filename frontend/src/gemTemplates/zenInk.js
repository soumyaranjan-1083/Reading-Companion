import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "zen-ink", name: "Zen Ink", description: "Washi paper, an ink enso, and a reader seal.", supportsPhoto: false, fonts: ["Playfair Display"], defaultAccent: "#b43f32" }, { quote: "'Playfair Display', 'Noto Sans Devanagari', Georgia, serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;