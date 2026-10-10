import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "sunset-poster", name: "Sunset Poster", description: "A vivid sunset mesh with a fine white poster frame.", supportsPhoto: false, fonts: ["Anton", "Inter"], defaultAccent: "#ffb340" }, { quote: "'Anton', 'Noto Sans Devanagari', Impact, sans-serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;