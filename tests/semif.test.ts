import assert from "node:assert/strict";
import test from "node:test";
import type { Snapshot } from "../lib/model";
import { categories } from "../lib/model";
import { evaluate } from "../lib/jev";
import {
  DIRECT_SYSTEM,
  directMessages,
  normalizeOllamaBase,
  probabilitiesFromLogprobs,
  rulesFromSemif,
  semifCall,
  softmax,
} from "../lib/semif";

const snapshot: Snapshot = {
  url: "https://example.com/article?token=private",
  context: { key: "synthetic", kind: "article", label: "article", origin: "https://example.com" },
  candidates: [
    {
      id: "e0",
      selector: "div.ad-banner",
      tag: "div",
      signals: "advertisement",
      text: "Advertisement",
      position: "static",
      count: 1,
    },
  ],
};

const letters = ["A", "B", "C", "D", "E", "F", "G"];

function chat(logprobs: number[], chosen = 1) {
  return {
    logprobs: [
      {
        token: letters[chosen],
        logprob: logprobs[chosen],
        top_logprobs: letters.map((token, index) => ({
          token: ` ${token}`,
          logprob: logprobs[index],
        })),
      },
    ],
  };
}

test("SemIf prompt is one letter decision and excludes the page URL", () => {
  const messages = directMessages(snapshot.candidates[0]!, snapshot.context.kind);
  assert.equal(messages[0]?.content, DIRECT_SYSTEM);
  const body = messages[1]?.content ?? "";
  assert.match(body, /"letter": "A"/);
  assert.match(body, /"letter": "G"/);
  assert.match(body, /cookie:/);
  assert.equal(body.includes("token=private"), false);
  assert.equal(body.includes("https://example.com"), false);
});

test("host normalization accepts localhost and rejects other schemes", () => {
  assert.equal(normalizeOllamaBase("http://127.0.0.1:11434/"), "http://127.0.0.1:11434");
  assert.equal(normalizeOllamaBase("http://127.0.0.1:11434/api/chat"), "http://127.0.0.1:11434");
  assert.throws(() => normalizeOllamaBase("file:///tmp/ollama"), /http\(s\)/);
  assert.throws(() => normalizeOllamaBase("http://user:secret@127.0.0.1:11434"), /credentials/);
});

test("letter logprobs softmax only when every option token is present", () => {
  const probabilities = probabilitiesFromLogprobs(chat([0, 2, 0, 0, 0, 0, 0]));
  assert.ok(probabilities);
  assert.ok(Math.abs(probabilities.ad - softmax([0, 2, 0, 0, 0, 0, 0])[1]!) < 1e-9);
  const missing = chat([0, 2, 0, 0, 0, 0, 0]);
  missing.logprobs[0]?.top_logprobs.splice(6, 1);
  missing.logprobs[0]!.token = "B";
  assert.equal(probabilitiesFromLogprobs(missing), null);
  assert.equal(probabilitiesFromLogprobs({}), null);
});

test("SemIf hides only a leading clutter option", () => {
  const strong = Object.fromEntries(categories.map((category) => [category, 0.03])) as Record<
    (typeof categories)[number],
    number
  >;
  strong.ad = 0.62;
  strong.keep = 0.2;
  assert.deepEqual(rulesFromSemif({ e0: strong }, snapshot.candidates), [
    { selector: "div.ad-banner", category: "ad", enabled: true },
  ]);
  assert.deepEqual(rulesFromSemif({ e0: { ...strong, ad: 0.4 } }, snapshot.candidates), []);
  assert.deepEqual(rulesFromSemif({ e0: { ...strong, keep: 0.55 } }, snapshot.candidates), []);
  assert.deepEqual(rulesFromSemif({ e0: null }, snapshot.candidates), []);
});

test("Ollama call is a one-token logprob read with thinking disabled", () => {
  const call = semifCall(
    snapshot.candidates[0]!,
    "article",
    "qwen3.5:4b",
    "http://127.0.0.1:11434",
  );
  assert.equal(call.url, "http://127.0.0.1:11434/api/chat");
  const body = JSON.parse(String(call.init.body));
  assert.equal(body.model, "qwen3.5:4b");
  assert.equal(body.think, false);
  assert.equal(body.logprobs, true);
  assert.equal(body.options.num_predict, 1);
  assert.equal(body.stream, false);
  assert.equal(String(call.init.body).includes("token=private"), false);
});

test("evaluate scores SemIf through Ollama and ignores response bodies on failure", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    assert.equal(url, "http://127.0.0.1:11434/api/chat");
    assert.equal(JSON.parse(String(init.body)).model, "qwen3.5:4b");
    return Response.json(chat([0, 2, 0, 0, 0, 0, 0]));
  });
  assert.deepEqual(await evaluate(snapshot, "qwen3.5:4b", "ollama", "http://127.0.0.1:11434"), [
    { selector: "div.ad-banner", category: "ad", enabled: true },
  ]);
});

test("Ollama HTTP failures do not echo the response body", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("private upstream", { status: 404 }));
  await assert.rejects(evaluate(snapshot, "missing:model", "ollama"), {
    message: "Ollama request failed: HTTP 404. Pull that model in Ollama first.",
  });
});

test("Ollama 403 names the extension origin setting", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("blocked", { status: 403 }));
  await assert.rejects(evaluate(snapshot, "qwen3.5:4b-mlx", "ollama"), /OLLAMA_ORIGINS/);
});
