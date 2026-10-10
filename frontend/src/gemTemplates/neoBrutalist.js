import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "neo-brutalist", name: "Neo Brutalist", description: "A bright accent field, heavy ink borders, and a hard shadow.", supportsPhoto: false, fonts: ["Anton", "Inter"], defaultAccent: "#f2c84b" }, { quote: "'Anton', 'Noto Sans Devanagari', Impact, sans-serif" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;