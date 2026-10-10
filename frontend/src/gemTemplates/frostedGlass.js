import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "frosted-glass", name: "Frosted Glass", description: "A glassy quote panel over a soft accent-colored atmosphere.", supportsPhoto: false, fonts: ["Inter", "Playfair Display"], defaultAccent: "#6a62d9" }, { quote: "'Inter', 'Noto Sans Devanagari', sans-serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;