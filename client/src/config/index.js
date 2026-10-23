// App settings. The money and timing rules live on the server (server/src/common/config.js);
// these copies are only used to show prices and countdowns before the server answers.
export const config = {
  appName: 'Campus Delights',
  tagline: 'Skip the queue. Eat between classes.',

  deliveryFee: 1.5,
  deliveryWindowMin: 10, // no courier within this many minutes -> the order switches to pickup

  // How many dishes a kitchen cooks at once (mirror of the server's KITCHEN_SLOTS).
  // The frontend wait-time engine uses this as its number of parallel stations.
  kitchenSlots: 2,

  // How often the screens ask the server for news (orders, queues, delivery jobs)
  pollMs: 4000,
  catalogPollMs: 20000, // stores, menus and venues change less often

  // false: a store takes orders whenever its "Taking orders" switch is on, and its opening hours are
  // only shown. true: it also has to be inside its opening hours (the prototype's behaviour).
  enforceOpeningHours: false,

  // Map tiles: OpenStreetMap's own tile server needs no API key (CARTO's now does).
  // Keep the attribution: OpenStreetMap requires it.
  tiles: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  // Walking routes (OSRM, foot profile). If it can't be reached, a straight-line estimate is used.
  routingUrl: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/',
  routingTimeoutMs: 2500,
}
