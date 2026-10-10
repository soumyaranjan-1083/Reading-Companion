import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "editorial-paper", name: "Editorial Paper", description: "Warm paper, a red rule, and a large serif drop quote.", supportsPhoto: false, fonts: ["Playfair Display", "Inter"], defaultAccent: "#9f3328" }, { quote: "'Playfair Display', 'Noto Sans Devanagari', Georgia, serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;