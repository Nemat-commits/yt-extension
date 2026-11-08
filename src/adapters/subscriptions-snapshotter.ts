import { SELECTORS, firstMatch } from './selector-registry';
import { extractVisibleSubscriptions } from './subscriptions-dom';
import { isFeatureCircuitOpen, recordFeatureFailure, recordFeatureSuccess } from './health';
import { saveFeedSnapshot } from '@src/data/storage';

const FEATURE_ID = 'subscriptionsAdapter';
const DEBOUNCE_MS = 250;
const ROOT_WAIT_MS = 5_000;

export class SubscriptionsSnapshotter {
  private observer: MutationObserver | null = null;
  private rootObserver: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private root: Element | null = null;
  private active = false;
  private onSnapshot: (() => void) | undefined;
  private startedAt = 0;

  start(onSnapshot: () => void): void {
    this.stop();
    this.active = true;
    this.onSnapshot = onSnapshot;
    this.startedAt = Date.now();
    void isFeatureCircuitOpen(FEATURE_ID).then((open) => {
      if (!this.active) return;
      if (open) {
        this.stop();
        return;
      }
      this.findRoot();
    });
  }

  stop(): void {
    this.active = false;
    this.observer?.disconnect();
    this.rootObserver?.disconnect();
    this.observer = null;
    this.rootObserver = null;
    this.root = null;
    this.onSnapshot = undefined;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private findRoot(): void {
    if (!this.active) return;
    const root = firstMatch<Element>(document, SELECTORS.subscriptionsBrowse);
    if (root) {
      this.attach(root);
      return;
    }
    if (Date.now() - this.startedAt >= ROOT_WAIT_MS) return;
    if (!this.rootObserver && document.documentElement) {
      this.rootObserver = new MutationObserver(() => {
        const found = firstMatch<Element>(document, SELECTORS.subscriptionsBrowse);
        if (found) {
          this.rootObserver?.disconnect();
          this.rootObserver = null;
          this.attach(found);
        } else if (Date.now() - this.startedAt >= ROOT_WAIT_MS) {
          this.rootObserver?.disconnect();
          this.rootObserver = null;
        }
      });
      this.rootObserver.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        if (!this.active || this.root) return;
        this.rootObserver?.disconnect();
        this.rootObserver = null;
      }, ROOT_WAIT_MS);
    }
  }

  private attach(root: Element): void {
    if (!this.active) return;
    this.root = root;
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.scheduleRead());
    this.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });
    this.scheduleRead();
  }

  private scheduleRead(): void {
    if (!this.active || !this.root) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.read();
    }, DEBOUNCE_MS);
  }

  private async read(): Promise<void> {
    const root = this.root;
    if (!this.active || !root) return;
    try {
      const items = extractVisibleSubscriptions(root);
      if (items.length > 0) {
        await recordFeatureSuccess(FEATURE_ID);
        await saveFeedSnapshot(items);
        this.onSnapshot?.();
        return;
      }

      const cardCount = root.querySelectorAll(SELECTORS.subscriptionCards.join(',')).length;
      // A zero-result read is only a selector failure if the feed has stamped card shells already.
      if (cardCount > 0) {
        const health = await recordFeatureFailure(FEATURE_ID);
        if (health.disabled[FEATURE_ID]) this.stop();
      }
    } catch {
      const health = await recordFeatureFailure(FEATURE_ID);
      if (health.disabled[FEATURE_ID]) this.stop();
    }
  }
}
