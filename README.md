# Unclutter

WXT extension for Chrome / Chromium and Firefox. Jev classifies nonessential page elements through Vercel AI Gateway; the extension stores and reapplies local hiding rules by page template.

## Load on MacBook Pro

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select `~/Downloads/Unclutter/chrome-mv3`.
4. Pin Unclutter, refresh any already-open website, then open its popup.
5. Under **Connection**, paste your **Vercel AI Gateway API key** and save it.
6. Click **Analyze page**. Gateway credits / Jev access are required.

For Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `firefox-mv2/manifest.json`. Temporary add-ons disappear on Firefox restart; permanent Firefox distribution requires Mozilla signing. Chrome/Edge/Brave can use the Chromium build. Safari packaging is not included.

TypeSafe AI direct is shown as **WIP** and cannot be selected. No key is bundled.

## Behavior

- Analysis is explicit, never automatic. New templates show **Not analyzed**.
- Saved templates apply without further model requests, including zero-rule results.
- Toolbar badge: green **ON** = saved and active; gray **OFF** = paused; amber **…** = analyzing; red **!** = failed. Tooltip includes actual hidden element count.
- **Pause / Resume** controls the current page type across tabs. The header switch disables the whole extension. Both restore hidden elements immediately.
- **Re-analyze** replaces this template's rules while preserving disabled rules that are still identified. Failed, malformed, or stale responses leave existing rules unchanged.
- Uncheck a rule in **Hidden elements** to keep those elements visible.
- **Forget this page type** removes its saved rules, restores the page, and permits a fresh analysis.
- Removing the API key leaves saved rules usable offline.

## Template reuse

Keys combine exact origin, policy version, page kind, normalized route family, and a stable main-shell marker. Homepage, article, product, search, listing, and generic routes stay separate. Article/product leaves and date/ID segments are normalized; tracking query parameters do not fragment the cache.

Examples: BBC `/news/articles/cabc123` and `/news/articles/cdef456` share a profile if their shells match. `/`, `/news`, and a different article shell do not. Generic short routes such as `/news/world` and `/news/business` stay separate. No global cross-domain rules.

This is a conservative heuristic, not perfect template recognition. Different route families may need separate initial analyses; different layouts sharing the same shell may share a profile. Every selector is revalidated against the current DOM before hiding. Stable `data-testid`, `data-component`, IDs, and classes are used; no positional selectors or AI-generated CSS. Randomized class-only pages may yield no safely targetable candidates. There is no periodic cache expiry or automatic paid retry. Re-analyze manually after site redesigns.

## Privacy and safety

- API key stays in local extension storage, **not encrypted** and not synced. Chrome restricts storage access to trusted extension contexts. It is never sent to page content scripts, websites, logs, or repository source.
- Only extension background code calls the fixed Gateway endpoint. Popup-origin checks protect settings and paid analysis actions.
- Each explicit analysis sends up to 60 bounded candidate descriptions (tag, structural signals, short text, position, match count). No full URL, query string, page title, main article body, form values, cookies, or raw HTML is sent. Email-like and long numeric strings in snippets are redacted, but this is **not a guarantee of anonymization**. Do not analyze sensitive pages if sending snippets to Vercel / TypeSafe AI is inappropriate.
- Jev receives typed keep/ad/promotion/newsletter/social/uncertain choices. Page text is untrusted evidence, not instructions. The model cannot emit code or selectors. Responses are validated for type, completeness, valid categories, and numeric ranges. Uncertain results remain visible. Where provided, selected-choice probability must be at least 0.9; this is a conservative operational threshold, not a calibrated accuracy claim.
- Main content, navigation, forms, cookie consent, login/payment/security, and paywalls are protected. Newsletter forms therefore stay visible in this initial version. No links are clicked, consent granted, requests blocked, or access restrictions bypassed. Hiding ads does not prevent their network/tracking activity.
- Hidden DOM nodes are not deleted. A temporary attribute plus extension-owned stylesheet implements hiding; removing the rules restores original markup/styles.
- Late-loaded elements are rechecked through a bounded/debounced mutation observer. SPA navigation restores the previous rules and resolves the new template. In-flight analyses are discarded after navigation or concurrent edits.
- Cross-origin iframe contents and shadow DOM are not traversed. A safely identified iframe container can be hidden. Native dialogs and embedded forms remain visible. Some promotional overlays may leave site-controlled scroll locks in place.
- HTTP(S) access is required to restore saved rules automatically on later visits. Internal browser pages, extension stores, PDFs and file URLs are not supported.

## Development

```sh
bun install
bun run check
bun run build
bun run build:firefox
```

On Kitze's Linux host, use `dev-guard run build -- ...` for build/check jobs and `dev-guard run preview -- bun run dev` for a preview. No background server is needed for unpacked builds.

Outputs: `.output/chrome-mv3/` and `.output/firefox-mv2/`. `bun run zip` packages Chromium.

Architecture: `lib/page-context.ts` identifies templates, `lib/dom.ts` extracts candidates and applies reversible rules, `lib/jev.ts` implements the evaluation-model v4 contract, `entrypoints/background.ts` owns credentials/cache/actions, `entrypoints/cleaner.content.ts` handles page lifecycle, and `entrypoints/popup/` provides controls. Settings and profiles use independent storage keys to avoid unrelated-tab write loss.
