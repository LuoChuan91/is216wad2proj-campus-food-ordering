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

```bash
cd server
cp .env.example .env   # then fill in the values (see "Environment variables")
pnpm install
pnpm dev
```

Check it works: http://localhost:3000/api/health returns `{"ok":true}`.

### 2. Client (in a second terminal)

```bash
cd client
pnpm install
pnpm dev
```

Any request from the Vue app to `/api/...` is forwarded to the server on port 3000, so call the API with relative URLs, e.g. `fetch('/api/stores')`.

### Client Supabase config for live update

The browser uses Supabase **Realtime** to know when a store's queue changes. Create 
an env file and fill in the **anon / publishable** key (never the secret
key - the anon key is safe in the browser because RLS still applies):

```bash
cd client
touch env
#   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=<anon or publishable key>
```

Then open http://localhost:5173. The student screens (a simpler, Bootstrap version of the prototype website):

| Address | Screen | Uses |
| ------- | ------ | ---- |
| `#/student` | Every store: open or closed, discount, today's hours, search | `GET /api/stores` |
| `#/student/store/<id>` | A store's page and its menu | `GET /api/stores/:id`, `GET /api/menu/:id` |
| `#/student/store/<id>/item/<id>` | Choose a dish's options and quantity, add to cart | `GET /api/menu/:id` |
| `#/student/checkout` | The cart and the price | (the cart in the browser) |
| `#/student/checkout/pay` | Simulated payment, which places the order | `POST /api/orders` |

There's no endpoint yet that lists a store's dishes, so for now only Sakura Bento House shows a dish (the one in `client/src/demo.js`).

## API

| Method | URL | What it does |
| ------ | --- | ------------ |
| GET | `/api/health` | Server is up |
| GET | `/api/stores` (optional `?venue_id=`) | List stores |
| GET | `/api/stores/:id` | One store |
| PATCH | `/api/stores/:id` | Update a store |
| GET | `/api/menu/:id` | One menu item with its option groups and options |
| POST | `/api/orders` | Place an order (body below). Returns the saved order with status 201 |
| GET | `/api/orders?store_id=` | A store's orders, newest first (shape below) |

`POST /api/orders` body. The browser sends only what was chosen, never prices. The server works out the price from the database:

```json
{
  "student_id": "<profile id>",
  "items": [{ "menu_item_id": "<id>", "qty": 2, "option_ids": ["<option id>", "<option id>"] }]
}
```

Errors come back as JSON with a status code, e.g. `400 { "error": "Toppings: pick 3 to 6" }`.

`GET /api/orders?store_id=` returns a list of orders like this (`payments` is a list, so the amount paid is `payments[0].amount`):

```json
[{
  "id": "<order id>", "status": "paid", "type": "pickup", "created_at": "2026-10-14T04:41:00Z", "subtotal": "22.60",
  "profiles": { "name": "Aiden Tan" },
  "order_items": [{ "qty": 2, "unit_price": "11.30", "menu_items": { "name": "Chicken Teriyaki Bento" },
                    "selected_options": ["<option id>", "<option id>"], "option_names": ["White Rice", "Add Tamago"] }],
  "payments": [{ "amount": "19.21", "status": "success", "reference": "SIM-1760416860000" }]
}]
```

## Client structure

```
client/
├── index.html                # page title and Bootstrap's CSS
└── src/
    ├── main.js               # starts Vue and loads our styles
    ├── App.vue               # top bar, and which screen to show for the address
    ├── router.js             # reads the address: route, paths, go(), closeSheet()
    ├── cart.js               # the cart shared by the screens
    ├── demo.js               # the student (and demo dish) used until there's sign-in
    ├── assets/style.css      # our colours and a few shared styles (everything else is Bootstrap)
    ├── components/
    │   └── StoreMono.vue     # a store's coloured initials square
    ├── utils/format.js       # money(), clockTime(), discountLabel(), todayHours(), ruleLabel() and more
    └── views/
        ├── StoreList.vue     # every store
        ├── StorePage.vue     # one store and its menu
        ├── ItemSheet.vue     # choose a dish's options and quantity
        ├── CheckoutPage.vue  # the cart and the price
        └── PaySheet.vue      # simulated payment, places the order
```

The look comes from Bootstrap classes in the templates (cards, list groups, badges, buttons, forms). `style.css` only adds the navy and orange colours (`bg-navy`, `btn-brand`), the page width (`page-narrow`), the sticky bottom bar (`bottom-bar`) and a few small pieces. Reuse these in new screens.

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

The tests in `server/test/` check the order rules in `services/orders.service.js`: server-side pricing (a tampered price from the browser is ignored), percentage and dollar discounts, closed stores, sold-out or archived dishes, unavailable options, each option group's min/max picks, and that only real database columns are saved. The repositories are replaced with fake data, so the tests never touch Supabase and give the same result every run.

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

## Environment variables

Copy `server/.env.example` to `server/.env` and fill these in:

| Variable                | Where to find it                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`        | Supabase dashboard → Project Settings → Data API → Project URL (no `/rest/v1` at the end) |
| `SUPABASE_SECRET_KEY` | Supabase dashboard → Project Settings → API Keys → secret key (`sb_secret_...`)          |
| `PORT`                | Defaults to `3000`                                                                           |

The secret key bypasses all database security rules. Keep it in `server/.env` only. Never put it in the client or commit it.

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
