# Campus Delights — Campus Food Ordering

A campus food‑ordering web app built to cut long canteen queues and stop students
being late for class. Students browse stores on a campus map, order for pickup or
peer delivery, pay (simulated), and track their order live. Fellow students can act
as couriers and earn the delivery fee. Merchants run a kitchen order board, and an
admin approves accounts and manages venues.

- **Client:** Vue 3 + Vite + Pinia + Vue Router + Leaflet
- **Server:** Express 5
- **Database / Realtime:** Supabase (Postgres + Realtime)

---

## 1. Setup & run

### Prerequisites

- Node.js 22.18+ or 24.12+ (`node -v`)
- pnpm (`pnpm -v`)
- A Supabase project (URL + keys)

### Clone

```bash
git clone https://github.com/LuoChuan91/is216wad2proj-campus-food-ordering.git        # placeholder — see section 3
cd is216wad2proj-campus-food-ordering
```

### Server (terminal 1)

The server holds the Supabase **secret** key and talks to the database.

```bash
cd server
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# edit .env — see "Environment variables" below
pnpm install
pnpm dev                    # starts on http://localhost:3000
```

Verify: open http://localhost:3000/api/health — it returns `{"ok":true}`.

See more detailed server documentation at [server/README.md](server/README.md)

### Client (terminal 2)

The client has its **own** `.env` for Supabase Realtime (the publishable key only).

```bash
cd client
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# edit .env — fill in the two VITE_ values
pnpm install
pnpm dev                    # starts on http://localhost:5173
```

Open http://localhost:5173. Requests to `/api/...` are proxied to the server on
port 3000, so the client uses relative URLs. Sign in by picking an account from the
list (see dummy accounts in section 4). Open a second browser tab as a different
account to watch an order move between roles in real time.

See more detailed client documentation at [client/README.md](client/README.md)

### Environment variables

Two `.env` files in two folders hold **different** keys. Never commit either — both
are in `.gitignore`.

| File | Variable | Where to find it (Supabase dashboard) |
| ---- | -------- | ------------------------------------- |
| `server/.env` | `SUPABASE_URL` | Project Settings → Data API → Project URL |
| `server/.env` | `SUPABASE_SECRET_KEY` | Project Settings → API Keys → **secret** key (`sb_secret_...`) — never ships to the browser |
| `server/.env` | `PORT` | optional, defaults to `3000` |
| `client/.env` | `VITE_SUPABASE_URL` | the same project URL |
| `client/.env` | `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **publishable** key (`sb_publishable_...`) |

> The map uses OpenStreetMap tiles (no key needed); walking routes come from the free
> OSRM service, with a straight‑line fallback when it can't be reached.

---

## 2. Live application

**Landing page:** `<DEPLOYED_URL>`  *(placeholder — replace with the live URL)*

---

## 3. Repository

**Git repo:** `https://github.com/LuoChuan91/is216wad2proj-campus-food-ordering.git`  *(placeholder — replace with the repo URL)*

---

## 4. Dummy accounts

Sign‑in is simulated (no password enforcement yet) — pick an account from the sign‑in
list. Credentials below are placeholders; replace with the real seeded accounts.

| Role | Purpose | Email (username) | Password |
| ---- | ------- | ---------------- | -------- |
| Student — buyer | Main flow: browse, order, pay, track | `aiden.tan.2021@scis.smu.edu.sg` | `123456` |
| Student — courier | Accept, pick up and deliver peer‑delivery jobs | `beatrice.lim.2021@business.smu.edu.sg` | `123456` |
| Merchant | Kitchen order board, menu & sold‑out switches | `hello@greenbowl.sg` | `123456` |
| Admin | Approve/block students, manage venues *(not part of the main flow)* | `priya.nair@smu.edu.sg` | `123456` |

> The courier is just a student account with "available for jobs" switched on — any
> student can deliver, as long as it isn't their own order.

---

## 5. Testing

### Unit & component tests (Vitest) — client

```bash
cd client
pnpm exec vitest run        # one-off run (CI mode)
pnpm test:unit              # watch mode
```

~350 tests across ~48 files. What's covered:

- **Pure logic (`src/utils`)** — pricing, discounts (percentage/dollar), option
  group min/max rules, server‑tamper resistance, time/clock formatting, the
  Haversine distance helper, the wait‑time engine (workstation batching, queue
  order), courier position/ETA along a route, OSRM routing with straight‑line
  fallback, order‑status transitions, and notification message wording.
- **Stores (Pinia — `src/stores`)** — app/catalog state and getters, order actions
  (place / accept / pick up / deliver), checkout state, admin actions
  (approve / block / remove / add venue), and the notifications store: history
  persistence, de‑duplication, and the poll‑diff "mirror" being suppressed while
  realtime is connected.
- **Composables (`src/composables`)** — the realtime primitive, live sync, wait‑time
  and open‑deliveries subscriptions, the courier GPS beacon, rider‑location polling,
  app bootstrap, and change announcements.
- **Components & views** — menu card, cart bar, drop‑off picker, order row/table,
  receipt, status tags, toggles, store cards/hero, wait‑time estimate, notification
  panel/toaster, plus merchant order/edit views and student store/tracking views.

### Server tests (Node test runner)

```bash
cd server
pnpm test
```

~75 tests covering the order rules (pricing from the DB, discounts, closed stores,
sold‑out dishes/options, option group min/max, column safety), peer‑delivery rules
and the 10‑minute expiry window, menu/store/profile services.

### End-to-end tests (Playwright)

The E2E suite drives the real app against the real database, then removes
everything it created. It needs `server/.env` and `client/.env` filled in (see
"Environment variables"), because it signs in with real Supabase accounts.

```bash
cd client
pnpm test:e2e
```

It runs in **Chromium only**. Running several browsers multiplies the sign-ins
and hits the Supabase auth rate limit, so the other browser projects are not
enabled.

What it covers:

| File | Journey |
| ---- | ------- |
| `e2e/specs/auth.spec.js` | Each role reaches its portal; wrong password rejected; non-SMU sign-up blocked |
| `e2e/specs/browse.spec.js` | Campus map renders; store list → store page → live wait |
| `e2e/specs/ordering.spec.js` | Add a dish → cart → checkout → pay → tracking → history |
| `e2e/specs/merchant.spec.js` | New order → Start cooking → Mark ready |
| `e2e/specs/tracking.spec.js` | A merchant status change updates the student's page live |
| `e2e/specs/delivery.spec.js` | Peer delivery: courier accepts, picks up, delivers |
| `e2e/specs/fallback.spec.js` | An unaccepted delivery switches to pickup and waives the fee |
| `e2e/specs/admin.spec.js` | Admin approvals screen renders |
| `e2e/specs/responsive.spec.js` | 390 / 768 / 1440 px with no horizontal scrolling |
| `e2e/specs/errors.spec.js` | Sold-out dish and empty search |

`e2e/global-setup.js` creates the `e2e.*` accounts and an `E2E Test Kitchen` with
one dish; `e2e/global-teardown.js` deletes them again, so the shared database is
left clean. Only chromium is installed — run `pnpm exec playwright install` to
add the other browsers.


---

## 6. AI usage

AI assistance was used on this project for:

- **First Prototype** — starting client application and server endpoints
- **UI design** — especially the icon set and the colour palette/visual styling.
- **Project structure** — help shaping the overall architecture and file layout of
  both client and server.
- **Maps & realtime** — implementing the Leaflet campus map, live rider tracking, and
  the Supabase Realtime features (orders, wait times, notifications).
- **Comments & cleanup** — writing code comments and refactoring/cleaning up the
  codebase.
- **Tests** — creating the unit, component and integration test suites.

All AI‑assisted code was reviewed and verified by running the test suites and clicking
through every screen as a student, courier, merchant and admin.

---

## Project layout (reference)

```
.
├── client/                 # Vue 3 app (Vite)
│   └── src/
│       ├── views/          # student / merchant / admin screens
│       ├── components/      # reusable UI (+ rider map)
│       ├── stores/          # Pinia: session, catalog, orders, ui, admin, notifications
│       ├── composables/     # realtime + live-sync hooks
│       ├── utils/           # pure logic: engine, waitTime, riderPosition, routing…
│       ├── services/        # auth + API client
│       └── router/          # routes + navigation guard
├── server/                 # Express 5 API
    └── src/                 # routes → controllers → services → models (repositories)
```
