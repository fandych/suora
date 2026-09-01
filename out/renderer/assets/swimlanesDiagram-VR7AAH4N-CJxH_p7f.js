import { c as createFlowDiagram, s as styles_default } from "./flowDiagram-HODETNUW-Bjh4L6g1.js";
import { _ as __name } from "./mermaid.core-DO7ZYiNC.js";
import "./index-I0BxrmAt.js";
import "./chunk-5VM5RSS4-BxoBqo6I.js";
import "./chunk-XXDRQBXY-DeqdQ7mN.js";
import "./chunk-POPQ4Y6H-B-dbNHk1.js";
import "./chunk-F27PBJKO-BH7qzpl1.js";
import "./channel-C7stuM5U.js";
var getStyles = /* @__PURE__ */ __name((options) => `${styles_default(options)}
  .swimlane.cluster rect {
    stroke: ${options.clusterBorder} !important;
  }
  [data-look="neo"].cluster rect {
    filter: none;
  }
`, "getStyles");
var styles_default2 = getStyles;
var diagram = createFlowDiagram({ defaultLayout: "swimlane", styles: styles_default2 });
export {
  diagram
};
