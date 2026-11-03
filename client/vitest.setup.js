// Global test setup. jsdom doesn't implement ResizeObserver, which Leaflet-backed
// components (e.g. RiderTracker's map) construct on mount; stub it so those mounts
// don't throw.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
