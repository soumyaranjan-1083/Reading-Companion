import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "chalkboard", name: "Chalkboard", description: "Slate grain, chalk lettering, doodles, and a hand-drawn underline.", supportsPhoto: false, fonts: ["Caveat"], defaultAccent: "#c6dda0" }, { quote: "'Caveat', 'Noto Sans Devanagari', cursive" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;