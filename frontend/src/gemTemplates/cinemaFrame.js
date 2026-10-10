import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "cinema-frame", name: "Cinema Frame", description: "A film still, letterbox bars, and subtitle-style quote.", supportsPhoto: true, fonts: ["Inter", "Playfair Display"], defaultAccent: "#e8c786" }, { quote: "'Inter', 'Noto Sans Devanagari', sans-serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;