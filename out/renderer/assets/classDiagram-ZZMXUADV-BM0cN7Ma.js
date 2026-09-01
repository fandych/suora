import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-TICWLB2K-Di2es2VA.js";
import { _ as __name } from "./mermaid.core-DO7ZYiNC.js";
import "./index-I0BxrmAt.js";
import "./chunk-5VM5RSS4-BxoBqo6I.js";
import "./chunk-XXDRQBXY-DeqdQ7mN.js";
import "./chunk-POPQ4Y6H-B-dbNHk1.js";
import "./chunk-F27PBJKO-BH7qzpl1.js";
var diagram = {
  parser: classDiagram_default,
  get db() {
    return new ClassDB();
  },
  renderer: classRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.class) {
      cnf.class = {};
    }
    cnf.class.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
