import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "notebook-highlight", name: "Notebook Highlight", description: "Ruled paper with a red margin and highlighted key words.", supportsPhoto: false, fonts: ["Caveat", "Inter"], defaultAccent: "#efc84a" }, { quote: "'Caveat', 'Noto Sans Devanagari', cursive" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;