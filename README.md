# is216wad2proj-campus-food-ordering

Campus Food Ordering Website to combat long queue times and risk of students being late to class

## Tech stack

- **Client:** Vue 3 + Vite (`client/campus-delights`)
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

## Server structure

One feature = one folder in `server/src`.

```
server/
├── index.js                  # starts the server
└── src/
    ├── app.js                # app setup + mounts each feature's routes
    ├── common/               # shared code
    │   ├── errorHandler.js   # turns thrown errors into JSON responses
    │   └── supabase.js       # the shared Supabase client
    └── stores/               # example feature
        ├── stores.routes.js      # URL -> controller function
        ├── stores.controller.js  # reads req, calls service, sends res
        ├── stores.service.js     # business rules, validation, calculations
        └── stores.repository.js  # the ONLY place that talks to Supabase
```

### Adding a feature

1. Create `server/src/<feature>/` with `<feature>.routes.js`, `.controller.js`, `.service.js` and `.repository.js` (copy `stores/` as a template).
2. Mount it in `server/src/app.js`:
   ```js
   app.use('/api/<feature>', require('./<feature>/<feature>.routes'));
   ```

### Rules

- Only `*.repository.js` files import `common/supabase.js`. Controllers and services never query the database directly.
- To return an error status, throw an error with a `status`, and `errorHandler` sends it as JSON:
  ```js
  const err = new Error('Store not found');
  err.status = 404;
  throw err;
  ```
- Supabase returns `{ data, error }` instead of throwing, so always check `error` in repositories: `if (error) throw error;`

## Environment variables

| Variable                | Where to find it                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`        | Supabase dashboard → Project Settings → Data API → Project URL (no`/rest/v1` at the end) |
| `SUPABASE_SECRET_KEY` | Supabase dashboard → Project Settings → API Keys → secret key (`sb_secret_...`)          |
| `PORT`                | Defaults to`3000`                                                                           |

The secret key bypasses all database security rules. Keep it in `server/.env` only. Never put it in the client or commit it.

## Git workflow

- Branch off `main` for each feature: `git checkout -b feat/<feature>`
- Always remember to pull from main to update your local branch before commiting
