import { evaluate } from "../lib/jev";
import type { Snapshot } from "../lib/model";

const key = process.env.AI_GATEWAY_API_KEY;
if (!key)
  throw new Error("AI_GATEWAY_API_KEY is required. Never pass it as a command-line argument.");
const snapshot: Snapshot = {
  url: "https://example.com/article/synthetic",
  context: { key: "synthetic", kind: "article", label: "article", origin: "https://example.com" },
  candidates: [
    {
      id: "e0",
      selector: "div.ad-banner",
      tag: "div",
      signals: "advertisement sponsored ad-banner",
      text: "Advertisement: save 30% on unrelated travel packages.",
      position: "static",
      count: 1,
    },
    {
      id: "e1",
      selector: "aside.article-context",
      tag: "aside",
      signals: "article-context",
      text: "Background: the scientific methods and sources used for this news article.",
      position: "static",
      count: 1,
    },
  ],
};
const start = performance.now();
const rules = await evaluate(snapshot, key);
if (!rules.some((rule) => rule.selector === "div.ad-banner"))
  throw new Error("Synthetic ad was not selected.");
if (rules.some((rule) => rule.selector === "aside.article-context"))
  throw new Error("Editorial context was incorrectly selected.");
console.log(
  `PASS: live Jev selected synthetic ad and kept editorial context (${Math.round(performance.now() - start)} ms).`,
);
