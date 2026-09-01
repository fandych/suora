import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-IMKFNOWR-NdoltXv6.js";
import { _ as __name } from "./mermaid.core-DO7ZYiNC.js";
import "./index-I0BxrmAt.js";
import "./chunk-XXDRQBXY-DeqdQ7mN.js";
import "./chunk-POPQ4Y6H-B-dbNHk1.js";
import "./chunk-F27PBJKO-BH7qzpl1.js";
var diagram = {
  parser: stateDiagram_default,
  get db() {
    return new StateDB(2);
  },
  renderer: stateRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.state) {
      cnf.state = {};
    }
    cnf.state.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
