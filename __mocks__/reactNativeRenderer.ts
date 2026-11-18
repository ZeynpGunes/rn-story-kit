// RNGH 2.x imports this module, which React Native 0.88 no longer ships. It is
// only used by a dev-time check of the detector's children; an empty host
// instance makes that check pass.
export default { findHostInstance_DEPRECATED: () => ({}) };
