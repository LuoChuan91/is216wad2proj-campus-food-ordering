# Campus Delights — Server (API)

The REST API behind the campus food‑ordering app. Express 5 over a Supabase
(Postgres) database. The browser never sends prices or trusts its own totals — the
server looks everything up in the database, re‑checks the rules, and computes the
real price.

- **Express 5** (async errors auto‑forwarded to the error handler)
- **Supabase** (Postgres) via `@supabase/supabase-js`, server‑side **secret** key
- **Node test runner** (`node --test`) for unit tests

---

## Run

```bash
cp .env.example .env     # Windows: Copy-Item .env.example .env
pnpm install
pnpm dev                 # node --watch, http://localhost:3000
# pnpm start             # production (no watch)
# pnpm test              # unit tests (node --test)
```

Health check: `GET http://localhost:3000/api/health` → `{"ok":true}`.

### Environment (`server/.env`)

| Variable | Notes |
| -------- | ----- |
| `SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → **secret** key (`sb_secret_...`). Bypasses Row‑Level Security — never ship to the browser |
| `PORT` | optional, defaults to `3000` |

---

## Architecture

Code is split by layer; each feature has one file per layer.

```
server/src/
├── app.js                 # express app: json body, mounts each feature's routes
├── common/
│   ├── config.js          # business settings (fee, delivery window, kitchen slots)
│   ├── engine.js          # shared pure helpers (round2, …)
│   ├── errorHandler.js    # turns thrown errors into { error } JSON
│   └── supabase.js        # the shared Supabase client (secret key)
├── routes/                # URL → controller
├── controllers/           # read req, call service, send res (no business logic)
├── services/              # rules, validation, pricing (no req/res, no DB)
└── models/                # *.repository.js — the ONLY files that touch Supabase
```

Request flow (placing an order):
`routes/orders.routes.js → controllers/orders.controller.js → services/orders.service.js → models/orders.repository.js → Supabase`

**Conventions**
- Only `models/*.repository.js` import `common/supabase.js`.
- To return an error, `throw` an `Error` with a `.status`; `errorHandler` sends it as
  `{ "error": "<message>" }` with that code (default 500). All errors use this shape.
- Some write endpoints read an actor id from the **`x-user-id`** request header for
  authorization (store/menu edits); there is no session/token layer yet.
- Business settings live in `common/config.js`: delivery fee **$0.80**, delivery
  window **10 min**, default kitchen slots **2**, wait strategies `serial` /
  `scheduled` (default `scheduled`).

---

## API reference

Base path: `/api`. All bodies and responses are JSON.

### Health

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/health` | Liveness probe → `{ "ok": true }` |

### Stores — `/api/stores`

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/stores` *(optional `?venue_id=`)* | List stores (optionally in one venue). Each store includes `workstations` and `wait_strategy` (normalised). |
| GET | `/api/stores/:id` | One store, or `404`. |
| PATCH | `/api/stores/:id` | Update a store. Needs `x-user-id` (the store's merchant, or an admin). |

`PATCH /api/stores/:id` — only these fields are accepted (anything else is ignored):
`name`, `is_open`, `description`, `open_hours`, `image_url`, `discount_type`,
`discount_per`, `discount_dol`, `workstations` (1–20), `wait_strategy`
(`serial` | `scheduled`). `open_hours` is `{ "mon": ["11:00","20:00"], … }` with
`HH:MM` times where open < close.

```jsonc
// PATCH /api/stores/s1   header: x-user-id: <merchant or admin id>
{ "is_open": false }
```

Errors: `401` not signed in, `403` not your store, `400` invalid field.

### Menu — `/api/menu`

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/menu` *(optional `?store_id=`)* | Every available dish (or one store's), each with `store_id`, `category` and nested `option_groups` → `options`. |
| GET | `/api/menu/:id` | One menu item with its option groups and options. |
| POST | `/api/menu` | Create a dish (`201`). Needs `x-user-id`. Body: `{ store_id, name, price, category, cook_time_sec, max_at_once, … }`. |
| PATCH | `/api/menu/:id` | Update a dish, e.g. sold‑out switch `{ "available": false }` or `{ "price": 6.5 }`. Needs `x-user-id`. |
| DELETE | `/api/menu/:id` | Remove/archive a dish. Needs `x-user-id`. |
| POST | `/api/menu/itemCookingDetails` | Cooking details for the wait‑time estimate. Body `{ "ids": ["<menu_item_id>", …] }` → `[{ id, cook_time_sec, max_at_once }]`. |

> A dish has no `store_id` column: it's resolved via
> `menu_items.menu_category_id → menu_category.store_id` and returned as `item.store_id`.

### Orders — `/api/orders`

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/api/orders` | Place an order (`201`). Server prices it from the DB. |
| GET | `/api/orders?store_id=` **or** `?student_id=` | A store's or a student's orders, newest first. |
| GET | `/api/orders/orderAhead?store_id=&order_id=` | Queue position for the wait‑time estimate → `{ orders, ahead }` (`order_id` optional). Note: this route is **before** `/:id`. |
| GET | `/api/orders/:id` | One order, or `404`. |
| PATCH | `/api/orders/:id` | Kitchen advances status: `{ "status": "preparing" }` → `"ready"` → `"completed"`. |

`POST /api/orders` body — the browser sends only choices, never prices:

```jsonc
{
  "student_id": "<profile id>",
  "type": "delivery",                 // "pickup" (default) or "delivery"
  "destination_id": "<destination id>", // required when type = delivery
  "note": "At the front desk",        // optional, delivery only, ≤ 80 chars
  "items": [
    { "menu_item_id": "<id>", "qty": 2, "option_ids": ["<opt>", "<opt>"] }
  ]
}
```

Returns the saved order with computed fields:

```jsonc
{
  "id": "<uuid>", "code": "E287", "status": "paid", "type": "pickup",
  "subtotal": 22.6, "delivery_fee": null, "discount": 3.39,
  "paid": 19.21, "fee_waived": 0, "total": 19.21, "fallback": false,
  "preparing_at": null, "student_name": "Aiden Tan",
  "order_items": [{ "qty": 2, "unit_price": "11.30",
    "menu_items": { "name": "Chicken Teriyaki Bento" },
    "selected_options": ["<opt>"], "option_names": ["White Rice", "Add Tamago"] }],
  "payment": { "amount": 19.21, "status": "success", "reference": "SIM-...", "method": "simulated" },
  "delivery": null
}
```

**Rules enforced**
- Only an **active student** may order; every item from **one open store**; option
  groups' min/max picks checked; sold‑out/archived dishes and sold‑out options refused.
- Price is computed server‑side (any price sent by the browser is ignored). The store
  discount applies to **food only**, never the delivery fee; delivery adds **$0.80**.
- Status moves **paid → preparing → ready → completed**, no skipping (`409` otherwise).
  Two simultaneous updates can't both win (the write only lands if the status is still
  the expected one). Delivery orders are completed by the courier, not this endpoint.

### Deliveries (peer delivery) — `/api/deliveries`

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/deliveries?status=open` | Jobs waiting for a courier (`?status=expired` → expired in the last 5 min). |
| GET | `/api/deliveries?courier_id=` | Every job a courier has taken on. |
| PATCH | `/api/deliveries/:id` | Courier or student action (below). |
| GET | `/api/deliveries/:id/location` | Courier's last GPS fix → `{ status, location: { lat, lng, accuracy, at } \| null }`. |
| PUT | `/api/deliveries/:id/location` | Courier's phone shares a fix. |

`PATCH /api/deliveries/:id`:

```jsonc
// courier
{ "action": "accept" | "pickup" | "deliver", "courier_id": "<profile id>" }
// student, only before a courier accepts
{ "action": "switch_to_pickup", "student_id": "<profile id>" }
```

`PUT /api/deliveries/:id/location`:

```jsonc
{ "courier_id": "<profile id>", "lat": 1.2966, "lng": 103.85, "accuracy": 12 }
```

**Rules enforced**
- A courier can't take **their own** order, carries at most **4** jobs at once, and
  can only **pick up** once the food is `ready`. Accept/pickup/deliver are guarded by
  status + ownership (`403`/`409`).
- **10‑minute window:** if nobody accepts in time, the delivery becomes `expired`, the
  order switches to **pickup** and the fee is **waived**. There's no cron — this check
  runs whenever orders or deliveries are read. `switch_to_pickup` lets the student end
  the wait early with the same result.
- GPS fixes are kept **in memory** only while the job is `accepted`/`picked_up`
  (a restart forgets them and the tracker falls back to an estimate).

### Profiles — `/api/profiles`

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/profiles` *(optional `?role=student\|merchant\|admin`)* | Accounts (id, role, name, email, status). |
| GET | `/api/profiles/:id` | One account. |
| PATCH | `/api/profiles/:id` | Admin sets status: `{ "status": "active" \| "inactive" \| "blocked" \| "removed" }`. |
| PATCH | `/api/profiles/:id/password-set` | Invited user marks their password chosen (reads `x-user-id`). |

### Venues & destinations

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/venues` | Venues on the campus map. |
| POST | `/api/venues` | Add a venue (`201`): `{ "name": "SMU Labs", "lat": 1.2965, "lng": 103.85, "type": "eatery" }`. |
| GET | `/api/destinations` | Drop‑off points for peer delivery. |

---

## Errors

Every error is JSON with the matching HTTP status:

```json
{ "error": "Toppings: pick 3 to 6" }
```

Common codes: `400` bad input / rule broken, `401` not signed in, `403` not allowed,
`404` not found, `409` state conflict (status moved, job already taken), `500`
unexpected.

---

## Testing

```bash
pnpm test        # node --test on server/test/
```

`server/test/` exercises the **services** with the repositories replaced by fakes, so
tests never touch Supabase and are deterministic:

- `orders.service.test.js` — server‑side pricing (a tampered browser price is ignored),
  percentage & dollar discounts, closed stores, sold‑out/archived dishes, unavailable
  options, option‑group min/max, status transitions, and that only real DB columns are saved.
- `deliveries.service.test.js` — accept/pickup/deliver guards, own‑order block, the
  4‑job limit, and the 10‑minute expiry → pickup/fee‑waived rule.
- `menu.service.test.js`, `stores.service.test.js`, `profiles.service.test.js` —
  listing, editable‑field whitelisting/validation, and authorization checks.

---

## Database notes

Things that are easy to get wrong:

- **Dishes have no `store_id`** — resolved via `menu_category.store_id` (see Menu above).
- **Discounts** use three columns: `discount_type` (`percentage` | `dollar` | null),
  `discount_per` (0–100), `discount_dol` (dollars off).
- **`orders`** stores `subtotal` and `delivery_fee` only; what the student paid is
  `payments.amount`. `code`, `discount`, `total`, `fallback` are computed at read time.
- **Enums:** `orders.status` (`pending`, `paid`, `preparing`, `ready`, `completed`,
  `cancelled`); `deliveries.status` (`open`, `accepted`, `picked_up`, `delivered`,
  `expired`); `payments.status` (`success`, `failed`).
- **`order_items.selected_options`** is a `uuid[]` of option ids; names are joined in
  and returned as `option_names`.
- **`payments.reference`** is required (e.g. `SIM-<timestamp>`).
- **Profiles** use `status` (`active`, `inactive`, `blocked`, `removed`) and `password_set`.

If every request fails with `permission denied for schema public`, the grants were
reset — re‑grant `service_role` on `schema public` in the Supabase SQL editor.
