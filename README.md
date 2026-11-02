# is216wad2proj-campus-food-ordering

Campus Food Ordering Website to combat long queue times and risk of students being late to class

## Tech stack

- **Client:** Vue 3 + Vite (`client`)
- **Server:** Express 5 (`server`)
- **Database:** Supabase (Postgres)

## Prerequisites

- Node.js 22.18+ or 24.12+ (`node -v`)
- pnpm (`pnpm -v`). Use pnpm everywhere, not npm.

## Getting started

```bash
git clone https://github.com/LuoChuan91/is216wad2proj-campus-food-ordering.git
cd is216wad2proj-campus-food-ordering
```

### 1. Server

Windows (PowerShell):

```powershell
cd server
Copy-Item .env.example .env   # then fill in the values (see "Environment variables")
pnpm install
pnpm dev
```

macOS / Linux:

```bash
cd server
cp .env.example .env
pnpm install
pnpm dev
```

Check it works: http://localhost:3000/api/health returns `{"ok":true}`.

### 2. Client (in a second terminal)

The client has its **own** env file, for Supabase Realtime. Without it the app
stops at start-up with a "Missing VITE_SUPABASE_URL" message.

```powershell
cd client
Copy-Item .env.example .env   # then fill in the two VITE_ values
pnpm install
pnpm dev
```

Any request from the Vue app to `/api/...` is forwarded to the server on port 3000, so call the API with relative URLs, e.g. `fetch('/api/stores')`.

Then open http://localhost:5173 and sign in by picking an account. Sign-in is simulated for now (no passwords): the accounts come from the `profiles` table. Open a second tab and sign in as someone else to watch an order move between them; every screen checks the server for news every few seconds.

### The website

| Address | Screen | Uses |
| ------- | ------ | ---- |
| `#/` | Sign in: pick a student, merchant or admin account | `GET /api/profiles` |
| `#/student` | Campus map with walking times; hover a building for its name and the nearest food | `GET /api/venues`, `GET /api/stores`, `GET /api/wait-times` |
| `#/student/venue/<id>` | The stores in one venue | |
| `#/student/stores` | Every store in one list, with search, filters and sorting | `GET /api/stores`, `GET /api/menu` |
| `#/student/store/<id>` | A store's menu; choose options and add to cart | `GET /api/menu` |
| `#/student/checkout` | Cart, pickup or peer delivery, ready time, price, simulated payment | `POST /api/wait-times/estimate`, `POST /api/orders` |
| `#/student/orders`, `#/student/orders/<id>` | Order history and live tracking | `GET /api/orders?student_id=` |
| `#/student/deliver` | Delivery jobs for student couriers: accept, pick up, deliver | `GET /api/deliveries`, `PATCH /api/deliveries/:id` |
| `#/student/me` | Profile, stats, "available for jobs" switch | |
| `#/merchant`, `#/merchant/menu` | Kitchen order board (New → Cooking → Ready) and sold-out switches | `GET /api/orders?store_id=`, `PATCH /api/orders/:id`, `PATCH /api/menu/:id`, `PATCH /api/stores/:id` |
| `#/admin`, `#/admin/venues`, `#/admin/stores` | Approve or block students, add venues on the map, every store | `GET/PATCH /api/profiles`, `POST /api/venues` |

The map uses OpenStreetMap's tiles, which need no API key (CARTO's tiles now need one). Walking routes come from the free OSRM service; if it can't be reached, the app uses a straight-line estimate.

## API

| Method | URL | What it does |
| ------ | --- | ------------ |
| GET | `/api/health` | Server is up |
| GET | `/api/stores` (optional `?venue_id=`) | List stores |
| GET | `/api/stores/:id` | One store |
| PATCH | `/api/stores/:id` | Update a store, e.g. `{ "is_open": false }` (only these columns: `is_open`, `description`, `open_hours`, `image_url`, `discount_type`, `discount_per`, `discount_dol`) |
| GET | `/api/menu` (optional `?store_id=`) | Every dish still on a menu, with `store_id`, `category` and its option groups |
| GET | `/api/menu/:id` | One menu item with its option groups and options |
| PATCH | `/api/menu/:id` | Sold-out switch: `{ "available": false }` |
| POST | `/api/orders` | Place an order (body below). Returns the saved order with status 201 |
| GET | `/api/orders?store_id=` or `?student_id=` | A store's or a student's orders, newest first (shape below) |
| GET | `/api/orders/:id` | One order |
| PATCH | `/api/orders/:id` | The kitchen moves an order along: `{ "status": "preparing" }`, then `"ready"`, then `"completed"` (pickup only) |
| GET | `/api/deliveries?status=open` | Delivery jobs waiting for a courier (`?status=expired`: expired in the last 5 minutes) |
| GET | `/api/deliveries?courier_id=` | Every job a student has taken on |
| PATCH | `/api/deliveries/:id` | `{ "action": "accept" \| "pickup" \| "deliver", "courier_id": "<profile id>" }` |
| PUT | `/api/deliveries/:id/location` | The courier's phone shares its GPS fix: `{ "courier_id": "<profile id>", "lat": 1.2966, "lng": 103.85, "accuracy": 12 }` (only the job's courier, only while accepted or picked up) |
| GET | `/api/deliveries/:id/location` | The courier's last fix for "Where is my rider": `{ "status": "picked_up", "location": { "lat", "lng", "accuracy", "at" } \| null }` |
| GET | `/api/profiles` (optional `?role=`) | Accounts (id, role, name, email, status) |
| GET | `/api/profiles/:id` | One account |
| PATCH | `/api/profiles/:id` | Admin changes a student's status: `{ "status": "active" }` |
| GET | `/api/venues` | Venues on the map |
| POST | `/api/venues` | Add a venue: `{ "name": "SMU Labs", "lat": 1.2966, "lng": 103.85 }` |
| GET | `/api/destinations` | Drop-off points for peer delivery |
| GET | `/api/wait-times` | Each store's current wait, and the ready time of every order in a queue |
| POST | `/api/wait-times/estimate` | When an order that isn't placed yet would be ready: `{ "store_id": "<id>", "items": [{ "menu_item_id": "<id>", "qty": 1 }] }` |

`POST /api/orders` body. The browser sends only what was chosen, never prices. The server works out the price from the database:

```json
{
  "student_id": "<profile id>",
  "type": "delivery",
  "destination_id": "<delivery_destinations id>",
  "note": "At the front desk",
  "items": [{ "menu_item_id": "<id>", "qty": 2, "option_ids": ["<option id>", "<option id>"] }]
}
```

`type` is `pickup` (the default) or `delivery`. For delivery, `destination_id` is required, the $1.50 fee is added after the discount, and a `deliveries` row opens with a 10-minute window. Errors come back as JSON with a status code, e.g. `400 { "error": "Toppings: pick 3 to 6" }`.

The order lists return each order with its items, payment and delivery nested, plus fields the server works out:

```json
[{
  "id": "<order id>", "code": "E287", "status": "paid", "type": "pickup", "created_at": "2026-10-14T04:41:00Z",
  "subtotal": 22.6, "discount": 3.39, "paid": 19.21, "total": 19.21, "fallback": false, "fee_waived": 0,
  "student_name": "Aiden Tan",
  "order_items": [{ "qty": 2, "unit_price": "11.30", "menu_items": { "name": "Chicken Teriyaki Bento" },
                    "selected_options": ["<option id>", "<option id>"], "option_names": ["White Rice", "Add Tamago"] }],
  "payment": { "amount": 19.21, "status": "success", "reference": "SIM-1760416860000", "method": "simulated" },
  "delivery": null
}]
```

### Rules the server enforces

- **Ordering:** only active student accounts; every item from one open store; option groups' min/max picks; sold-out dishes and options are refused.
- **Kitchen:** `paid → preparing → ready → completed`, no skipping. Two clicks at once can't both win (the update only happens if the status is still the expected one).
- **Peer delivery:** a courier can't take their own order, has one job at a time, and can only pick up once the food is ready. If nobody accepts within 10 minutes, the delivery expires, the order becomes a pickup and the fee is waived. There's no scheduled job, so this check runs whenever orders or deliveries are read.
- **Wait times** (`common/engine.js`): each store cooks `KITCHEN_SLOTS` batches at once; each order line is `ceil(qty / max_at_once)` batches of `cook_time_sec`; orders already cooking keep their slot and waiting orders take the next free one, first come first served.

## Client structure

```
client/
├── index.html                  # page title and fonts
└── src/
    ├── main.js                 # starts Vue, loads Bootstrap and our styles
    ├── App.vue                 # sign-in page, or the top bar and the signed-in person's portal
    ├── assets/app.css          # every style (from the prototype website)
    ├── app/
    │   ├── config.js           # app name, poll interval, map tiles, opening-hours rule
    │   ├── api.js              # every call to our Express API (axios)
    │   ├── state.js            # app state (S), questions about it (Q) and every action (A)
    │   ├── live.js             # start-up, polling, notifications, address bar
    │   ├── engine.js           # option rules, prices, time and distance helpers
    │   ├── routing.js          # walking routes (OSRM)
    │   └── landmarks.js        # campus buildings shown on the map
    ├── components/             # Icon, AppMark, Mono, Avatar, WaitChip, Toasts, SignIn, TopNav
    └── portals/
        ├── student/            # map, store list, store, item, checkout, payment, tracking, orders, deliver, me
        ├── merchant/           # order board and menu
        └── admin/              # students, venues map, stores
```

Every screen reads from `S` and changes things only through actions in `A`, and every action calls the API in `api.js`. The older single-screen files (`router.js`, `cart.js`, `demo.js`, `views/`, `components/StoreMono.vue`, `utils/format.js`) aren't used by this version.

## Server structure

Code is split by layer. Each feature has one file in each layer folder.

```
server/
├── index.js                     # starts the server
├── .env.example                 # copy to .env and fill in
├── test/                        # unit tests (pnpm test)
└── src/
    ├── app.js                   # app setup + mounts each feature's routes
    ├── common/                  # shared code
    │   ├── config.js            # delivery fee, 10-minute window, kitchen slots
    │   ├── engine.js            # the wait-time engine (pure functions)
    │   ├── errorHandler.js      # turns thrown errors into JSON responses
    │   └── supabase.js          # the shared Supabase client
    ├── routes/                  # URL -> controller function
    ├── controllers/             # reads req, calls the service, sends res
    ├── services/                # business rules, validation, calculations (no req/res, no database)
    └── models/                  # *.repository.js: the ONLY files that talk to Supabase
```

For example, placing an order goes:
`routes/orders.routes.js` → `controllers/orders.controller.js` → `services/orders.service.js` → `models/orders.repository.js` → Supabase.

### Adding a feature

1. Create one file per layer, copying the `stores` files as a template:
   `routes/<feature>.routes.js`, `controllers/<feature>.controller.js`, `services/<feature>.service.js`, `models/<feature>.repository.js`.
2. Mount it in `server/src/app.js`:
   ```js
   app.use('/api/<feature>', require('./routes/<feature>.routes'));
   ```

### Rules

- Only `models/*.repository.js` files import `common/supabase.js`. Controllers and services never query the database directly.
- To return an error status, throw an error with a `status`, and `errorHandler` sends it as JSON:
  ```js
  const err = new Error('Store not found');
  err.status = 404;
  throw err;
  ```
- Supabase returns `{ data, error }` instead of throwing, so always check `error` in repositories: `if (error) throw error;`
- Use `.maybeSingle()` (not `.single()`) when a row might not exist; it returns `null` instead of an error.

## Testing

```bash
cd server
pnpm test
```

The tests in `server/test/` check the order rules (`orders.service.test.js`), peer delivery and the 10-minute rule (`deliveries.service.test.js`) and the wait-time engine (`engine.test.js`). The order tests cover server-side pricing (a tampered price from the browser is ignored), percentage and dollar discounts, closed stores, sold-out or archived dishes, unavailable options, each option group's min/max picks, and that only real database columns are saved. The repositories are replaced with fake data, so the tests never touch Supabase and give the same result every run.

## Database notes

Things in the live database that are easy to get wrong:

- **Dishes don't have a `store_id`.** `menu_items.menu_category_id` → `menu_category.store_id`. `menu.repository.js` looks this up and returns it as `item.store_id`.
- **Store discounts** use three columns: `discount_type` (`percentage`, `dollar` or empty), `discount_per` (0–100) and `discount_dol` (dollars off).
- **`orders`** stores `subtotal` (before discount) and `delivery_fee`, but no discount or total. What the student paid is `payments.amount`.
- **Status values** are Postgres enums:
  - `orders.status`: `pending`, `paid`, `preparing`, `ready`, `completed`, `cancelled`
  - `deliveries.status`: `open`, `accepted`, `picked_up`, `delivered`, `expired`
  - `payments.status`: `success`, `failed`
- **`order_items.selected_options`** is a list of option ids (`uuid[]`).
- **`payments.reference`** is required (e.g. `SIM-<timestamp>`).
- **Profiles** use `status` (`active`, `inactive`, `blocked`, `removed`) and `password_set`, not `is_approved`.

Not in the database yet, so the app works around them. Add the columns if you want them saved properly:

| What | Workaround now | Column to add |
| ---- | -------------- | ------------- |
| When an order started cooking | The server remembers it until it restarts, otherwise uses `paid_at` | `orders.preparing_at` |
| How many dishes a kitchen cooks at once, and how wait times are estimated | Until the columns exist, every store uses 2 workstations and the `scheduled` strategy | `stores.workstations`, `stores.wait_strategy` (set by the merchant on the order board) |
| A short order number | First 4 characters of the order id, e.g. `#E287` | `orders.code` |
| "Available for delivery jobs" | Remembered in each browser | `profiles.courier_available` |
| Notifications (the bell and pop-ups) | Each browser compares what the server says now with a few seconds ago | a `notifications` table |
| Store colour, initials, cuisine | Worked out from the name and menu categories | `stores.color`, `stores.cuisine` |

## Environment variables

There are **two** env files, in two folders, holding **different keys**.

| File | Variable | Where to find it | Safe in the browser? |
| ---- | -------- | ---------------- | -------------------- |
| `server/.env` | `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL (no `/rest/v1` at the end) | — |
| `server/.env` | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → **secret** key (`sb_secret_...`) | ❌ **Never.** It bypasses all Row-Level Security |
| `server/.env` | `PORT` | Defaults to `3000` | — |
| `client/.env` | `VITE_SUPABASE_URL` | The same project URL | ✅ |
| `client/.env` | `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **publishable** key (`sb_publishable_...`) | ✅ RLS still applies |

`server/.env.example` and `client/.env.example` are templates with no real values.
Copy each one to `.env` in the same folder, then fill in the values. Ask the person
who owns the Supabase project for the real keys.

**Never commit a `.env` file.** Both are in `.gitignore`. If a secret key leaks,
rotate it in the Supabase dashboard.

If every request fails with `permission denied for schema public`, the database's grants were reset (e.g. by recreating the `public` schema). Run this in the Supabase SQL Editor:

```sql
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;
```

## Git workflow

1. Start from the latest `main`: `git checkout main && git pull`
2. Branch off for each feature: `git checkout -b feat/<feature>`
3. Commit and push: `git push -u origin feat/<feature>`
4. Open a pull request into `main` on GitHub, get a teammate to look at it, then merge.
5. Delete the branch (GitHub's **Delete branch** button, then `git branch -d feat/<feature>`).

If you're midway on a branch and `main` has moved on, bring the changes in with `git merge main`.

## AI assistance

We used Claude (Anthropic's AI assistant) on this project. Keep this section up to date if more AI help is used.

- **Generated with AI on this branch:** the Vue port of our prototype website (everything in `client/src/app`, `client/src/components`, `client/src/portals`, `client/src/assets/app.css`, `App.vue` and `main.js`), and the new API endpoints for venues, destinations, profiles, deliveries, wait times, menu lists and order status, with their tests (`deliveries.service.test.js`, `engine.test.js` and the new cases in `orders.service.test.js`). The prototype website it was ported from was also made with Claude.
- **Written by the team:** TODO: list what each of us wrote (e.g. the database, the first API endpoints and tests, the first student screens), and any other parts where we had AI help.
- **How we checked it:** we ran the unit tests (`pnpm test` in `server`) and clicked through every screen as a student, merchant, courier and admin.
