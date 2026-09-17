import { browser } from "wxt/browser";
import { collectCandidates, createCleaner } from "../lib/dom";
import { pageContext } from "../lib/page-context";
import { unwrap, type PageState, type Profile, type Reply } from "../lib/model";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main(ctx) {
    const cleaner = createCleaner(document);
    let state: PageState = {
      context: pageContext(document, location.href),
      profile: null,
      enabled: true,
      hiddenCount: 0,
    };
    let revision = 0;
    let timeout: number | undefined;
    let lastUrl = location.href;
    const sync = async () => {
      const version = ++revision;
      const context = pageContext(document, location.href);
      if (context.key !== state.context.key || lastUrl !== location.href) {
        cleaner.restore();
        state.hiddenCount = 0;
      }
      lastUrl = location.href;
      const result = unwrap(
        (await browser.runtime.sendMessage({
          type: "sync",
          context,
          hiddenCount: state.hiddenCount,
        })) as Reply<{ profile: Profile | null; enabled: boolean }>,
      );
      if (version !== revision || ctx.isInvalid) return state;
      state = { context, ...result, hiddenCount: 0 };
      state.hiddenCount = cleaner.apply(
        state.enabled && state.profile?.enabled ? state.profile.rules : [],
      );
      // Update badge with actual match count, not count of stored selectors.
      await browser.runtime.sendMessage({ type: "sync", context, hiddenCount: state.hiddenCount });
      return state;
    };
    const safelySync = () =>
      void sync().catch(() => {
        cleaner.restore();
      });
    const schedule = () => {
      clearTimeout(timeout);
      timeout = ctx.setTimeout(safelySync, 180);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id", "data-testid", "data-component", "content"],
    });
    ctx.addEventListener(window, "wxt:locationchange", () => {
      revision++;
      cleaner.restore();
      state.hiddenCount = 0;
      schedule();
    });
    const listener = (
      message: { type?: string },
      sender: { id?: string },
      sendResponse: (reply: Reply<unknown>) => void,
    ) => {
      if (sender.id !== browser.runtime.id) return;
      const respond = async () => {
        if (message.type === "refresh" || message.type === "state") return sync();
        if (message.type === "snapshot")
          return {
            context: pageContext(document, location.href),
            candidates: collectCandidates(document),
            url: location.href,
          };
        throw new Error("Unknown page request.");
      };
      void respond().then(
        (data) => sendResponse({ ok: true, data }),
        () => sendResponse({ ok: false, error: "Page connection unavailable. Refresh this tab." }),
      );
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(() => {
      revision++;
      clearTimeout(timeout);
      observer.disconnect();
      cleaner.restore();
      browser.runtime.onMessage.removeListener(listener);
    });
    safelySync();
  },
});
