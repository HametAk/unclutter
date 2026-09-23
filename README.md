# Unclutter

Fork of [kitze/unclutter](https://github.com/kitze/unclutter). The extension hides ads, cookie dialogs, and other nonessential page elements, then reapplies those rules locally by page template.

This fork adds **Ollama (SemIf)**: classification on your machine with [SemIf](https://github.com/TheoLeeCJ/SemIf)'s letter-logit readout. Hosted Jev through Vercel AI Gateway or TypeSafe AI is unchanged. SemIf is not Jev and is not affiliated with TypeSafe.

## Download

Install a built bundle from [releases](https://github.com/HametAk/unclutter/releases). Steps: [docs/install.md](docs/install.md).

Current build: **0.4.0**

- `unclutter-0.4.0-chrome.zip` — Chrome, Edge, Brave, and other Chromium browsers. Unzip, then **Load unpacked**.
- `unclutter-0.4.0-firefox.zip` — Firefox 140+. Load as a temporary add-on. It is removed when Firefox quits.

Then open the popup:

1. **Connection** → **Ollama (SemIf)**.
2. Set the model and host. Details, including the `OLLAMA_ORIGINS` setting Ollama requires before it will answer an extension: [docs/ollama.md](docs/ollama.md).
3. **Manual** (default) and **Analyze page**, or **On page visit**.

Hosted providers still take an API key in that same popup. One credential is stored for Gateway/TypeSafe, and the Ollama model and host are stored separately. Switching provider does not delete the other. Nothing is bundled.

## Ollama

```sh
ollama pull qwen3.5:4b-mlx
```

```sh
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*,safari-extension://*"
```

Quit Ollama and open it again. Linux and Windows notes are in [docs/ollama.md](docs/ollama.md).

Each element is one next-token logprob read (`think: false`, `num_predict: 1`, `top_logprobs: 20`). A clutter category is hidden only when its probability is at least 0.5 and it leads `keep` and `uncertain` by 0.12. Those scores are uncalibrated option probabilities, not Jev confidence. Snippets go only to the saved host. No API key is sent.

Hosted Jev still uses its own gates: when a probability or confidence is present, both must be at least 0.9.

## Behavior

- **Manual**: analysis only when you click **Analyze page / Re-analyze**.
- **On page visit**: analyze new templates in visible tabs, after a short render-settling delay. This sends candidate snippets to the selected provider. Hosted providers charge for that call. Off by default.
- Saved templates apply without further model requests, including zero-rule results. New analysis-rubric versions may refresh an enabled old template once in automatic mode; paused profiles and disabled rules are preserved.
- Automatic attempts are deduplicated across tabs and persisted before the request. Failure or interruption does not trigger automatic retries; click **Analyze page / Re-analyze**.
- Cookie overlays (including Sourcepoint's session-numbered iframe/container IDs and BBC's `ngasCookiePrompt`) can be hidden. No Accept/Reject buttons are clicked and no consent choice is written.
- Empty ad wrappers and their reserved-height, padding, and advertisement labels collapse too, stopping before useful sibling content. Normal overflow-based cookie scroll locks are released while the overlay is hidden and restored when paused.
- Toolbar badge: green **ON** = saved and active; gray **OFF** = paused; amber **…** = analyzing; red **!** = failed. The tooltip includes the hidden-element count.
- **Pause / Resume** controls the current page type across tabs. The header switch disables the whole extension. Both restore hidden elements immediately.
- **Re-analyze** replaces this template's rules while preserving disabled rules that are still identified. Failed, malformed, or stale responses leave existing rules unchanged.
- Uncheck a rule in **Hidden elements** to keep those elements visible.
- **Forget this page type** removes its saved rules, restores the page, and permits a fresh analysis.
- Removing the API key or Ollama model leaves saved rules usable offline.

## Template reuse

Keys combine exact origin, policy version, page kind, normalized route family, and a stable main-shell marker. Homepage, article, product, search, listing, and generic routes stay separate. Article and product leaves and date or ID segments are normalized; tracking query parameters do not fragment the cache.

Examples: BBC `/news/articles/cabc123` and `/news/articles/cdef456` share a profile if their shells match. `/`, `/news`, and a different article shell do not. Generic short routes such as `/news/world` and `/news/business` stay separate. There are no global cross-domain rules.

This is a conservative heuristic. Different route families may need separate initial analyses; different layouts sharing the same shell may share a profile. Every selector is revalidated against the current DOM before hiding. Stable `data-testid`, `data-component`, IDs, and classes are used. There are no positional selectors or model-written CSS. Randomized class-only pages may yield no safely targetable candidates. Re-analyze manually after a site redesign.

## Privacy and safety

- The API key, Ollama model, and Ollama host stay in local extension storage, **not encrypted** and not synced. Chrome restricts storage access to trusted extension contexts. They are never sent to page content scripts, websites, logs, or repository source.
- Only extension background code calls the provider. Popup-origin checks protect settings and manual analysis. Page-visit requests require the saved automatic-mode opt-in.
- Each analysis sends up to 60 bounded candidate descriptions (tag, structural signals, short text, position, match count). No full URL, query string, page title, main article body, form values, cookies, or raw HTML is sent. Email-like and long numeric strings in snippets are redacted. That is **not a guarantee of anonymization**. Do not analyze sensitive pages if sending snippets to the selected host is inappropriate.
- The model receives typed keep/ad/promotion/newsletter/social/cookie/uncertain choices. Page text is untrusted evidence, not instructions. The model cannot emit code or selectors. Responses are validated for type, completeness, valid categories, and numeric ranges. Uncertain results remain visible. Invalid or non-finite values reject the response.
- Main content, navigation, ordinary forms, login, payment, security, and paywalls are protected. Cookie-dialog headings and checkbox controls may hide with their containing overlay, but sensitive inputs still block hiding. No links are clicked, no consent is granted, no requests are blocked, and no access restriction is bypassed. Hiding a cookie dialog is not a consent choice. Hiding ads does not stop their network requests.
- Hidden DOM nodes are not deleted. A temporary attribute, an extension-owned stylesheet, and reversible inline display overrides remove occupied space. Original style values are restored.
- Late-loaded elements are rechecked through a bounded mutation observer. SPA navigation restores the previous rules and resolves the new template. In-flight analyses are discarded after navigation or concurrent edits.
- Cross-origin iframe contents and shadow DOM are not traversed. HTTP(S) access is required to restore saved rules on later visits. Internal browser pages, extension stores, PDFs, and file URLs are not supported.

## Development

Requires [Bun](https://bun.sh) and Node.js 22.12 or newer.

```sh
git clone https://github.com/HametAk/unclutter.git
cd unclutter
bun install --frozen-lockfile
bun run check
bun run build
bun run zip
bun run build:firefox
bun x wxt zip -b firefox
```

`bun run dev` is WXT development mode. Checks use synthetic fixtures and need no key. Optional live smoke: `JEV_KEY` or `TYPESAFE_API_KEY` for TypeSafe, `AI_GATEWAY_API_KEY` for Gateway, or `OLLAMA_MODEL` for SemIf. Set only one family. Never pass a key as a command-line argument. Never commit `.env` files, API keys, browser profiles, or real browsing data.

Outputs: `.output/chrome-mv3/` and `.output/firefox-mv2/`.

Architecture: `lib/page-context.ts` identifies templates, `lib/dom.ts` extracts candidates and applies reversible rules, `lib/jev.ts` calls Gateway and TypeSafe, `lib/semif.ts` calls Ollama, `entrypoints/background.ts` owns credentials, cache, and actions, `entrypoints/cleaner.content.ts` handles page lifecycle, and `entrypoints/popup/` provides controls.

## Upstream

Behavior of the hiding rules, template keys, and hosted Jev calls comes from [kitze/unclutter](https://github.com/kitze/unclutter), MIT licensed. This fork tracks that project and adds the local provider.

## License

[MIT](LICENSE).
