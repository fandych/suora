import { _ as __name } from "./mermaid.core-DO7ZYiNC.js";
import { s as select } from "./index-I0BxrmAt.js";
var getDiagramElement = /* @__PURE__ */ __name((id, securityLevel) => {
  let sandboxElement;
  if (securityLevel === "sandbox") {
    sandboxElement = select("#i" + id);
  }
  const root = securityLevel === "sandbox" ? select(sandboxElement.nodes()[0].contentDocument.body) : select("body");
  const svg = root.select(`[id="${id}"]`);
  return svg;
}, "getDiagramElement");
export {
  getDiagramElement as g
};
