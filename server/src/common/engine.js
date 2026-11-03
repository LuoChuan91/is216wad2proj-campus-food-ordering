// Shared money rounding. Used by orders.service for pricing.
// (The wait-time kitchen engine was re-ported to the client in
// client/src/utils/waitTime.js, which is the single source of truth now.)
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

module.exports = { round2 };
