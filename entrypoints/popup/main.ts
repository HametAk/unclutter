import { browser } from "wxt/browser";
import { ANALYSIS_VERSION, unwrap, type PageState, type Reply } from "../../lib/model";
import { DEFAULT_OLLAMA_BASE } from "../../lib/semif";
import {
  providerLabel,
  providerKeyLabel,
  resolveProvider,
  type Provider,
} from "../../lib/providers";
import "./style.css";

const get = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: ${id}`);
  return element as T;
};
const analyze = get<HTMLButtonElement>("analyze");
const toggle = get<HTMLButtonElement>("toggle");
const global = get<HTMLInputElement>("global");
const mode = get<HTMLSelectElement>("analysis-mode");
const provider = get<HTMLSelectElement>("provider");
const errorBox = get("error");
let tabId: number | undefined;
let hasKey = false;
let working = false;
let savedProvider: Provider = "vercel";
let savedModel = "";
let ollamaDirty = false;
let current: (PageState & { busy: boolean; error: string | null }) | null = null;
let poll: ReturnType<typeof setTimeout> | undefined;

async function request<T>(message: object): Promise<T> {
  return unwrap((await browser.runtime.sendMessage(message)) as Reply<T>);
}
function error(error: unknown) {
  errorBox.textContent =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unexpected error.";
  errorBox.hidden = false;
}
function render() {
  const busy = working || current?.busy;
  analyze.disabled = !current || !hasKey || !global.checked || !!busy;
  analyze.textContent = busy ? "Analyzing…" : current?.profile ? "Re-analyze" : "Analyze page";
  toggle.hidden = !current?.profile;
  toggle.disabled = !!busy || !global.checked;
  toggle.textContent = current?.profile?.enabled ? "Pause" : "Resume";
  const selectedProvider = resolveProvider(provider.value);
  const local = selectedProvider === "ollama";
  provider.disabled = working;
  get("cloud-fields").hidden = local;
  get("ollama-fields").hidden = !local;
  get<HTMLInputElement>("api-key").placeholder = `Paste ${providerKeyLabel(selectedProvider)} key`;
  get("key-status").textContent = hasKey
    ? local
      ? `Ollama · ${savedModel}`
      : `${selectedProvider === "typesafe" ? "TypeSafe" : "Vercel"} · Key saved`
    : local
      ? "Model required"
      : "API key required";
  get("engine").textContent = local ? "SemIf" : "Jev";
  get("disclosure").textContent = local
    ? "Analyze sends up to 60 element descriptions to your Ollama host. Main article text and form values are excluded; snippets may still contain personal data."
    : `Analyze sends up to 60 element descriptions to ${providerLabel(selectedProvider)}. Main article text and form values are excluded; snippets may still contain personal data.`;
  get("auto-disclosure").textContent = local
    ? "On page visit sends element snippets to your Ollama host for new templates. Snippets may contain personal data. Cached templates are reused."
    : `On page visit automatically sends element snippets to ${providerLabel(selectedProvider)} for new templates. Snippets may contain personal data. API charges apply. Cached templates are reused.`;
  const remove = get<HTMLButtonElement>("remove-key");
  remove.hidden = !hasKey;
  remove.textContent = local ? "Remove saved model" : "Remove saved key";
  get("disclosure").hidden = !current || mode.value === "auto";
  get("auto-disclosure").hidden = mode.value !== "auto";
  get("mode-hint").textContent =
    mode.value === "auto"
      ? "On page visit · Cached templates reused"
      : "Manual analysis · Cached rules apply automatically";
  if (!current) return;
  const { profile, context, hiddenCount } = current;
  get("host").textContent = new URL(context.origin).hostname;
  get("template").textContent = context.label;
  get("hidden").textContent = String(hiddenCount);
  get("saved").textContent = profile
    ? `Saved ${new Date(profile.analyzedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";
  const status = get("status");
  const paused = !global.checked || profile?.enabled === false;
  status.textContent = busy
    ? "Analyzing"
    : paused
      ? "Paused"
      : profile
        ? profile.analysisVersion < ANALYSIS_VERSION
          ? "Update available"
          : "Saved template"
        : "Not analyzed";
  status.className = `badge ${busy ? "busy" : profile && !paused ? "active" : ""}`;
  get("rules-section").hidden = !profile;
  get("rule-count").textContent =
    `${profile?.rules.filter((rule) => rule.enabled).length ?? 0} rules`;
  const rules = get("rules");
  rules.replaceChildren();
  if (profile && !profile.rules.length) {
    const empty = document.createElement("p");
    empty.className = "disclosure";
    empty.textContent = profile.candidateCount
      ? "No clearly removable elements found."
      : "No safely targetable elements found.";
    rules.append(empty);
  }
  for (const rule of profile?.rules ?? []) {
    const label = document.createElement("label");
    label.className = "rule";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = rule.enabled;
    checkbox.disabled = !!busy;
    checkbox.setAttribute("aria-label", `Hide ${rule.selector}`);
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = rule.category;
    const selector = document.createElement("code");
    selector.textContent = rule.selector;
    info.append(title, selector);
    label.append(checkbox, info);
    rules.append(label);
    checkbox.addEventListener(
      "change",
      () => void act({ type: "rule", tabId, selector: rule.selector, enabled: checkbox.checked }),
    );
  }
}
async function load() {
  const config = await request<{
    enabled: boolean;
    hasKey: boolean;
    mode: "manual" | "auto";
    provider: Provider;
    ollamaModel: string;
    ollamaBase: string;
  }>({
    type: "settings",
  });
  hasKey = config.hasKey;
  global.checked = config.enabled;
  mode.value = config.mode;
  savedProvider = resolveProvider(config.provider);
  savedModel = config.ollamaModel;
  provider.value = savedProvider;
  if (!ollamaDirty) {
    get<HTMLInputElement>("ollama-model").value = config.ollamaModel;
    get<HTMLInputElement>("ollama-base").value = config.ollamaBase || DEFAULT_OLLAMA_BASE;
  }
  if (tabId !== undefined) {
    try {
      current = await request({ type: "status", tabId });
      if (current?.error) error(current.error);
    } catch (err) {
      current = null;
      get("status").textContent = "Unavailable";
      error(err);
    }
  }
  render();
  clearTimeout(poll);
  if (
    current?.busy ||
    (current &&
      !current.error &&
      config.mode === "auto" &&
      config.enabled &&
      hasKey &&
      current.profile?.enabled !== false &&
      (!current.profile || current.profile.analysisVersion < ANALYSIS_VERSION))
  )
    poll = setTimeout(() => void load().catch(error), 900);
}
async function act(message: object) {
  if (working) return;
  working = true;
  errorBox.hidden = true;
  get("notice").hidden = true;
  render();
  try {
    await request(message);
    await load();
  } catch (err) {
    provider.value = savedProvider;
    error(err);
  } finally {
    working = false;
    render();
  }
}

analyze.addEventListener("click", () => void act({ type: "analyze", tabId }));
toggle.addEventListener(
  "click",
  () => void act({ type: "toggle", tabId, enabled: !current?.profile?.enabled }),
);
global.addEventListener("change", () => void act({ type: "global", enabled: global.checked }));
mode.addEventListener("change", () => void act({ type: "mode", mode: mode.value }));
provider.addEventListener(
  "change",
  () => void act({ type: "provider", provider: resolveProvider(provider.value) }),
);
get("forget").addEventListener("click", () => void act({ type: "forget", tabId }));
get("remove-key").addEventListener("click", () => void act({ type: "removeKey" }));
for (const id of ["ollama-model", "ollama-base"])
  get<HTMLInputElement>(id).addEventListener("input", () => {
    ollamaDirty = true;
  });
get("save-ollama").addEventListener("click", () => {
  const model = get<HTMLInputElement>("ollama-model").value.trim();
  const base = get<HTMLInputElement>("ollama-base").value.trim();
  if (!model) {
    error(new Error("Enter an Ollama model name."));
    return;
  }
  void (async () => {
    await act({ type: "saveOllama", model, base: base || DEFAULT_OLLAMA_BASE });
    if (errorBox.hidden) {
      ollamaDirty = false;
      get<HTMLDetailsElement>("connection").open = false;
      get("notice").textContent = "Ollama model saved. Analyze a page to verify SemIf readout.";
      get("notice").hidden = false;
    }
  })();
});
get("key-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (resolveProvider(provider.value) === "ollama") return;
  const input = get<HTMLInputElement>("api-key");
  const key = input.value.trim();
  if (!key) {
    error(new Error(`Enter a ${providerKeyLabel(resolveProvider(provider.value))} API key.`));
    return;
  }
  void (async () => {
    await act({ type: "saveKey", key, provider: resolveProvider(provider.value) });
    input.value = "";
    if (errorBox.hidden) {
      get<HTMLDetailsElement>("connection").open = false;
      get("notice").textContent = "API key saved. Analyze a page to verify access.";
      get("notice").hidden = false;
    }
  })();
});
void (async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  await load();
  get<HTMLDetailsElement>("connection").open = !hasKey;
})().catch(error);
