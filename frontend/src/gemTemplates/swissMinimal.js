import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "swiss-minimal", name: "Swiss Minimal", description: "A strict grid, oversized grotesque type, and one color block.", supportsPhoto: false, fonts: ["Space Grotesk"], defaultAccent: "#e64a35" }, { quote: "'Space Grotesk', 'Noto Sans Devanagari', sans-serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;