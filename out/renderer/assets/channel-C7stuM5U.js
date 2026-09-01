import { ah as Utils, ai as Color } from "./mermaid.core-DO7ZYiNC.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
