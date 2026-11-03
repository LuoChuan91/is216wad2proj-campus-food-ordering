# Campus Delights — Client

The front end of the campus food‑ordering app: a single‑page Vue 3 application where
students browse stores on a campus map, order for pickup or peer delivery, pay
(simulated) and track orders live; where fellow students act as couriers; and where
merchants and an admin manage kitchens, accounts and venues.

- **Vue 3** (`<script setup>`) + **Vite** build
- **Pinia** for state, **Vue Router** (hash history) for navigation
- **Leaflet** for maps, **GSAP** for animation, **Bootstrap 5** for base styling
- **Supabase Realtime** for live updates, with API polling as a fallback
- **Vitest** + **@vue/test-utils** for tests (Playwright for e2e, WIP)

See the root `README.md` for full setup, env vars, deployed URL and dummy accounts.
Quick start:

```bash
pnpm install
pnpm dev          # http://localhost:5173  (/api proxied to :3000)
pnpm vitest run   # unit + component tests
pnpm build        # production build to dist/
```

---

## Structure

```
src/
├── main.js            # app entry: bootstrap → install router → mount
├── App.vue            # root shell (layout + global toaster)
├── config/            # app config: name, poll interval, map tiles, fee, rules
├── common/            # supabase.js — the shared Realtime client
├── services/          # api.js (axios → Express) + authService.js (sign-in)
├── stores/            # Pinia state (see below)
├── composables/       # live data / realtime hooks (see below)
├── utils/             # pure logic: pricing, wait time, routing, positions…
├── router/            # routes, guard, nav helpers, URL↔state sync
├── layouts/           # Student / Staff page frames + tab view
├── views/             # routed screens, grouped by role
├── portals/           # role-specific child components used inside views
├── components/         # shared, reusable UI (+ rider map)
└── assets/            # main.css (design tokens, theming) + images
```

### Layers at a glance

| Layer | Role |
| ----- | ---- |
| `services` | The only place that talks to the outside world — `api.js` wraps every Express `/api/...` call (axios); `authService.js` handles the simulated sign‑in. |
| `stores` (Pinia) | The single source of truth. Views read from stores and change things only through store actions; actions call `services`. |
| `composables` | Reusable reactive hooks that keep store data **live** — one realtime primitive plus feature hooks for orders, wait times, deliveries and notifications. |
| `utils` | Pure, framework‑free functions (easy to unit‑test): pricing, discounts, option rules, time/clock, distance, wait‑time engine, rider position, routing. |
| `views` / `portals` / `components` | The UI. `views` are routed screens; `portals` are the role‑specific pieces inside them; `components` are shared across roles. |

---

## Stores (`src/stores`)

| Store | Holds / does |
| ----- | ------------ |
| `session.js` | Who is signed in (per browser tab); sign‑in / sign‑out. |
| `catalog.js` | Venues, stores and menus; decorates stores with colour/initials; lookup getters (`store`, `venue`, `dropoff`). |
| `orders.js` | The student's orders, courier jobs and earnings; actions to place / accept / pick up / deliver / cancel. |
| `merchant.js` | The kitchen order board and menu sold‑out switches for a merchant. |
| `admin.js` | Admin actions: approve / block / remove students, add a venue. |
| `ui.js` | View state: cart, checkout choices, courier on/off, clock, poll loop, the poll‑diff notification path. |
| `notifications.js` | Notification history (persisted per user) + the active‑toast queue; de‑dups events from realtime vs polling. |
| `pinia.js` | The shared Pinia instance. |

---

## Composables (`src/composables`)

Live data flows through these so the UI updates without manual refreshes.

| Composable | Keeps live |
| ---------- | ---------- |
| `realtime/useRealtimeResource.js` | The shared primitive: subscribe to a Supabase channel, re‑fetch on change, auto‑reconnect. |
| `realtime/channels.js` | Channel/table definitions the primitive subscribes to. |
| `useLiveSync.js` | Top‑level wiring that keeps the signed‑in person's data fresh. |
| `useStoreOrdersLive.js` | A merchant's incoming orders in real time. |
| `useWaitTime.js` / `storeWaitCache.js` | Each store's live wait estimate (shared cache so a store is subscribed once). |
| `useOpenDeliveries.js` | Open courier jobs appearing/expiring. |
| `useRiderLocation.js` | `useRiderLocation` polls the courier's last GPS fix ("Where is my rider"); `useCourierBeacon` shares this phone's GPS to in‑progress jobs. |
| `useRealtimeNotifications.js` | Status events pushed straight to the notifications store. |
| `useCartEstimate.js` | Live price/ready‑time estimate while building a cart. |
| `useAppBootstrap.js` | Start‑up: load catalog, restore sign‑in, start the clock/poll loop. |

**Realtime + polling (resilience):** realtime is the primary path. A polling loop
(`ui.js`) runs alongside as a fallback so the app still works if the socket drops;
when realtime is connected, the poll path suppresses duplicate status notifications,
and a short de‑dup window covers connect/disconnect transitions.

---

## Key utilities (`src/utils`)

| File | Pure logic |
| ---- | ---------- |
| `engine.js` | Option‑group rules, unit/line pricing, discounts, time & clock formatting, Haversine distance, walk estimate. |
| `waitTime.js` / `waitTimeApi.js` / `waitSettings.js` | The front‑end wait‑time engine: workstation batching and first‑come‑first‑served queueing. |
| `riderPosition.js` | Where the courier is along the route and metres/seconds left. |
| `routing.js` / `mapApi.js` | Walking routes from OSRM with a straight‑line fallback and route caching. |
| `orderStatus.js` | Order status transitions and labels. |
| `notificationMessages.js` | Builds notification title/body/variant from a raw event. |
| `pickupSwitch.js` | Expired‑delivery → pickup conversion logic. |

> Prices and rules here are **display‑only**; the server re‑checks everything and
> sets the real price.

---

## Routing (`src/router`)

- `index.js` — route table (hash history, `#/...`), grouped by role.
- `nav.js` — a small bridge so store actions can navigate (router injected in `main.js`).
- `sync.js` — keeps the `ui` store's current tab/page in step with the URL.
- A navigation **guard** enforces access: not signed in → sign‑in; wrong role or a
  not‑yet‑approved student → bounced appropriately.

---

## Screens (`src/views`, with pieces in `src/portals`)

**Student** (`views/student`, `portals/student`)
- `ExploreView` — campus map (Leaflet) with walking times and nearest food.
- `StoresView` / `StoreView` — browse/search stores, open a menu, add to cart (`ItemSheet`).
- `CheckoutView` — cart, pickup vs peer delivery, drop‑off, live estimate, simulated pay (`PaySheet`).
- `OrdersView` / `TrackView` — history and live tracking, including "Where is my rider" (`components/rider/RiderTracker`).
- `DeliverView` — courier jobs: accept, pick up, deliver; shares live GPS while delivering.
- `MeView` / `PendingView` — profile & stats; waiting‑for‑approval screen.

**Merchant** (`views/merchant`, `portals/merchant`)
- `MerchantOrdersView` — kitchen board, orders move New → Cooking → Ready (`OrderCard`).
- `MerchantMenuView` / `MerchantStoreView` — menu sold‑out switches (`MenuItemAdminCard`) and store settings.

**Admin** (`views/admin`, `portals/admin`)
- `AdminApprovalsView` — approve / block students.
- `AdminVenuesView` — add venues on a map (`AdminMap`).
- `AdminStoresView` — every store.

**Shared:** `SignInView`, `NotificationsView`, `NotFoundView`; `layouts/` wrap each
role; `components/` holds reusable UI (icons, cards, tags, toggles, toaster, rider map).

---

## Testing

```bash
pnpm vitest run     # one-off (CI); pnpm test:unit for watch mode
pnpm test:e2e       # Playwright e2e — work in progress
```

~350 tests across ~48 files cover pure utils (pricing, rules, wait‑time, routing,
rider position, messages), Pinia stores (orders, checkout, admin, notifications),
composables (realtime, live sync, GPS beacon), and components/views. jsdom lacks
`ResizeObserver`, so `vitest.setup.js` polyfills it for Leaflet‑backed components.
