import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "cosmic", name: "Cosmic", description: "A deep starfield with a fine orbit and quiet nebula light.", supportsPhoto: false, fonts: ["Playfair Display", "Inter"], defaultAccent: "#92a8ff" }, { quote: "'Playfair Display', 'Noto Sans Devanagari', Georgia, serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;