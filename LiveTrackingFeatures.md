# Live Tracking Features

Behaviour reference for the realtime features. All of them follow the same shape:
Supabase Realtime **broadcast** tells the browser "something changed", and the
browser **refetches** the real data from the Express API. If Realtime can't
connect, each feature **polls** instead, so it still updates (just slower).

Common env setup: `client/.env` needs `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. SQL triggers live in `realtime_*.sql` (run in Supabase
after `createDB.sql`).

---

## 1. Estimated wait time

Core logic lives in the `useWaitTime(storeId, orderId?, options?)` composable,
which returns reactive `{ seconds, loading, error, stale, liveConnected, refresh }`.
Two UIs consume it:

- **`WaitTimeEstimate.vue`** — a small badge. Props: `storeId` (required),
  `orderId`, `strategy` (`serial | bottleneck | factor | scheduled`), `stations`,
  `pollMs`. It formats `seconds` into a label (e.g. "~8 min") and shows a green
  **live** badge when connected, or a **stale** badge if a refresh failed.
  ```vue
  <WaitTimeEstimate :store-id="storeId" />                     <!-- whole store queue -->
  <WaitTimeEstimate :store-id="storeId" :order-id="orderId" /> <!-- one order's wait -->
  ```

- **`OrderTrackingView.vue`** (`/orders/:orderId/track?store_id=&mode=&status=`) —
  calls `useWaitTime` once and turns `seconds` into an **ETA clock time**
  (now + wait = "ready at"; for delivery it adds a placeholder walking time =
  "arrives around"). Also shows the order reference and an animated status
  timeline (preparing → ready → picked up; pickup stops at ready).

Behaviour: refreshes automatically when the store's queue changes (order added,
or an order becomes ready/cancelled). Keeps the last number on a failed refresh.

---

## 2. Notifications

Per-user toasts + a history list, driven by the `user:<id>` broadcast channel.

- **Toasts** (`NotificationToaster.vue`, mounted app-wide) pop up at the
  **bottom-left**, stack, and auto-dismiss after ~6s (or on close). They appear
  for: order **ready**, order **completed**, delivery **ready (accepted)**,
  order **picked up**.
- **History** — every notification (also order **paid** and delivery
  **delivered**) is kept in the notifications store and shown in the panel.
- **Bell** (`NotificationBell.vue`) shows an unread count. On **≥ md** it opens a
  Bootstrap offcanvas panel; on **< md** it links to the full-screen
  `/notifications` page. The bell is self-contained — drop it into the real
  navbar when that exists.

Behaviour: a student only ever receives **their own** notifications (RLS scopes
the channel to their user id). Nothing shows until a user is logged in.

---

## 3. Dependency: `authStore` — what is needed from others

Notifications need to know **who is logged in** to pick the right channel
(`user:<id>`). This is the only external dependency.

- `useAuthStore()` exposes `userId` (ref) and `ready`, and must be started once
  with `auth.init()` (done in `App.vue` on mount).
- **What's required from the auth/login team:** a working Supabase session, i.e.
  the user is signed in via `supabase.auth` so that `supabase.auth.getUser()`
  returns the user. The store reads `userId` from the session and follows
  login/logout via `onAuthStateChange` automatically.
- If no one is logged in, `userId` is `null`, the notification subscription
  simply does not start, and nothing breaks. Once login happens, it connects on
  its own.

Nothing else is needed — no custom events, no extra API.

---

## 4. Live update for merchants — how to use it

For the merchant order dashboard. The dashboard UI and the orders-fetch API are
owned by other teammates; this provides only the **live refresh**.

Use the `useStoreOrdersLive(storeId, options?)` composable. It returns reactive
`{ orders, loading, error, stale, liveConnected, refresh }`.

```js
import { useStoreOrdersLive } from '@/composables/useStoreOrdersLive.js'

// Default: fetches GET /api/orders?store_id=<id>
const { orders, liveConnected, stale, error } = useStoreOrdersLive(storeId)

// Or inject your own fetch (if the dashboard uses a different endpoint):
const { orders } = useStoreOrdersLive(storeId, {
  fetchOrders: (id) => myApi.getStoreOrders(id), // must return an array or { orders: [] }
})
```

Behaviour: the dashboard's `orders` list refreshes automatically when an order
for that store becomes **paid** (new incoming order), **ready**, or
**cancelled**. On a failed refresh it keeps the last list and sets `stale`; if
Realtime is down it polls every 30s. Just render `orders`.

Notes:
- No "preparing" transition is broadcast — moving fetched orders to *preparing*
  is a dashboard-side decision. (A future preparing tab needs no change here; the
  list already refetches on any order change.)
- Requires `realtime_merchant_orders.sql` to be run in Supabase.

---

## 5. Where is my rider

A 2D map on the tracking page (`components/rider/RiderTracker.vue`, Leaflet + GSAP)
while a peer delivery is accepted or picked up: the walking route, the store and the
drop-off, the courier as a moving beacon, how many metres away they are and when they
should arrive.

- **Courier side** (`useCourierBeacon` in `DeliverView.vue`): while the courier has jobs
  in progress, the phone's GPS is followed and the latest fix is sent every 5s with
  `PUT /api/deliveries/:id/location`. A line under "Current deliveries" says whether it is
  sharing. GPS needs https (or localhost) and the courier's permission.
- **Student side** (`useRiderLocation`): polls `GET /api/deliveries/:id/location` every
  `pollMs`. The chip says **Live GPS** for a fix under 45s old; otherwise **Estimated**, and
  the courier is placed along the route by walking time since pickup (75 m/min, never
  shown as arrived). Maths in `utils/riderPosition.js`.
- The server keeps only the last fix per delivery, in memory, and stops returning it once
  the delivery is done. A server restart just means "Estimated" until the next fix.
- Map can't load: the card still shows distance, arrival time and progress.

