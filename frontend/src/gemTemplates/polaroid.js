import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "polaroid", name: "Polaroid", description: "A taped photo print with a handwritten caption.", supportsPhoto: true, fonts: ["Caveat", "Inter"], defaultAccent: "#d5b994" }, { quote: "'Caveat', 'Noto Sans Devanagari', cursive" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const render = template.render;
export default template.Component;