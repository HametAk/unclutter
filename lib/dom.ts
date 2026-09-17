import type { Candidate, Rule } from "./model";

const protectedSelector =
  'html,body,main,article,header,nav,h1,[role="main"],[role="navigation"],form,input,textarea,select,[contenteditable="true"],dialog';
const clutter =
  /(?:^|[-_\s])(?:ad|ads|advert|advertisement|advertising|sponsor|sponsored|promo|promotion|banner|newsletter|subscribe|subscription|upsell|popup|modal|overlay|share|social|recommendations|related|cookie|consent)(?:$|[-_\s])/i;
const stable = (value: string) =>
  value.length >= 3 &&
  value.length < 90 &&
  /^[a-zA-Z_][\w-]*$/.test(value) &&
  !/\d{4}|[a-f0-9]{8}|^(css|sc|jsx)-/i.test(value);

export function isProtected(el: Element): boolean {
  if (el.matches(protectedSelector) || el.querySelector(protectedSelector)) return true;
  if (el.closest('[contenteditable="true"],form')) return true;
  const identity = `${el.id} ${el.className} ${el.getAttribute("aria-label") ?? ""}`;
  if (
    /paywall|sign[-_ ]?in|log[-_ ]?in|captcha|checkout|payment|cookie|consent|privacy[-_ ]?(?:choice|setting)/i.test(
      identity,
    )
  )
    return true;
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  // Do not bypass consent, authentication, paywalls, or a site's security gates.
  if (
    /manage (?:your )?(?:consent|cookies)|accept all cookies|cookie (?:settings|preferences)|sign in to continue|subscribe to (?:read|continue)|verify you are human/i.test(
      text,
    )
  )
    return true;
  return (
    text.length > 2000 ||
    [...el.querySelectorAll("p")].some((p) => (p.textContent?.length ?? 0) > 600)
  );
}

export function matchingElements(doc: Document, selector: string): Element[] {
  // Our selectors only consist of a tag plus a single stable local attribute.
  // No combinators, positional selectors, CSS directives, or model-written CSS.
  if (
    !/^[a-z][a-z0-9-]*(?:\[data-(?:testid|component|test|qa)="[\w-]{3,89}"\]|#[\w-]{3,89}|\.[\w-]{3,89})$/.test(
      selector,
    )
  )
    return [];
  try {
    const elements = [...doc.querySelectorAll(selector)];
    if (elements.length > 20 || elements.some(isProtected)) return [];
    return elements;
  } catch {
    return [];
  }
}

function selectorFor(el: Element, doc: Document): string | null {
  const tag = el.tagName.toLowerCase();
  const options: string[] = [];
  for (const attr of ["data-testid", "data-component", "data-test", "data-qa"]) {
    const value = el.getAttribute(attr);
    if (value && stable(value)) options.push(`${tag}[${attr}="${value}"]`);
  }
  if (stable(el.id)) options.push(`${tag}#${el.id}`);
  const classes = [...el.classList]
    .filter(stable)
    .sort((a, b) => Number(clutter.test(b)) - Number(clutter.test(a)));
  options.push(...classes.map((c) => `${tag}.${c}`));
  return options.find((selector) => matchingElements(doc, selector).includes(el)) ?? null;
}

function redact(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "[URL]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\b(?:\d[ -]?){8,}\b/g, "[number]");
}

export function collectCandidates(doc: Document): Candidate[] {
  const elements = [...doc.querySelectorAll('aside,section,div,[role="dialog"],iframe')].slice(
    0,
    6000,
  );
  const seen = new Set<string>();
  const output: Candidate[] = [];
  for (const el of elements) {
    if (output.length >= 60) break;
    const signals = `${el.id} ${[...el.classList].join(" ")} ${el.getAttribute("data-testid") ?? ""} ${el.getAttribute("data-component") ?? ""} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("role") ?? ""}`;
    const position = doc.defaultView?.getComputedStyle(el).position ?? "static";
    if (
      !clutter.test(signals) &&
      !el.matches('aside,[role="dialog"],iframe') &&
      !["fixed", "sticky"].includes(position)
    )
      continue;
    if (isProtected(el)) continue;
    const selector = selectorFor(el, doc);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);
    const copy = el.cloneNode(true) as Element;
    copy
      .querySelectorAll("script,style,noscript,svg,input,textarea,select,[contenteditable]")
      .forEach((node) => node.remove());
    output.push({
      id: `e${output.length}`,
      selector,
      tag: el.tagName.toLowerCase(),
      signals: redact(signals).slice(0, 300),
      text: redact((copy.textContent ?? "").replace(/\s+/g, " ").trim()).slice(0, 450),
      position,
      count: matchingElements(doc, selector).length,
    });
  }
  return output;
}

export function createCleaner(doc: Document) {
  const attribute = `data-unclutter-${crypto.randomUUID().replaceAll("-", "")}`;
  const style = doc.createElement("style");
  style.textContent = `[${attribute}] { display: none !important; }`;
  const marked = new Set<Element>();
  const restore = () => {
    for (const el of marked) el.removeAttribute(attribute);
    marked.clear();
    style.remove();
  };
  const apply = (rules: Rule[]) => {
    const next = new Set(
      rules.filter((r) => r.enabled).flatMap((r) => matchingElements(doc, r.selector)),
    );
    for (const el of marked)
      if (!next.has(el)) {
        el.removeAttribute(attribute);
        marked.delete(el);
      }
    for (const el of next)
      if (!marked.has(el)) {
        el.setAttribute(attribute, "");
        marked.add(el);
      }
    if (marked.size && !style.isConnected) (doc.head ?? doc.documentElement).append(style);
    if (!marked.size) style.remove();
    return marked.size;
  };
  return { restore, apply };
}
