// Feature flags for the first store release.
// The shop shows prices but in-app purchases aren't wired yet (no RevenueCat),
// and stores reject non-functional purchase buttons — keep it dev-only for now.
export const SHOP_ENABLED = __DEV__;
