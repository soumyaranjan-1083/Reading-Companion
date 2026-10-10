import { createTemplate } from "./createTemplate.js";
const template = createTemplate({ id: "neon-terminal", name: "Neon Terminal", description: "A luminous terminal prompt over scan-lined black.", supportsPhoto: false, supportsEffect: false, fonts: ["Space Mono"], defaultAccent: "#54ffc1" }, { quote: "'Space Mono', 'Noto Sans Devanagari', monospace" });
export const { id, name, description, supportsPhoto, fonts, defaultAccent } = template;
export const supportsEffect = template.supportsEffect;
export const render = template.render;
export default template.Component;