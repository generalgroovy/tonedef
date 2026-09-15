import { generate, randomize } from "./generator.js";
self.onmessage = ({ data }) => {
  try {
    const result =
      data.mode === "randomize"
        ? randomize(data.project)
        : { project: generate(data.project), changed: [] };
    self.postMessage({ ok: true, ...result });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message });
  }
};
