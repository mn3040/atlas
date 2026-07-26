import '@testing-library/jest-dom/vitest'

// jsdom has no IntersectionObserver -- framer-motion's whileInView (used for
// scroll-triggered reveals) needs one to mount without throwing. Deliberately
// not `implements IntersectionObserver`: that interface gains new required
// members across TS/DOM-lib versions (e.g. scrollMargin), and pinning this
// mock to it just to satisfy one TS version breaks the build on the next.
class MockIntersectionObserver {
  root: Element | Document | null = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
}
