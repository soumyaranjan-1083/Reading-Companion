import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "typewriter-archive", name: "Typewriter Archive", description: "Aged paper, inked type, and a dated saved-gem stamp.", supportsPhoto: false, fonts: ["Special Elite"], defaultAccent: "#845b37" }, { quote: "'Special Elite', 'Noto Sans Devanagari', 'Courier New', monospace" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;