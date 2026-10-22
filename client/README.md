# campus-delights

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Compile and Minify for Production

```sh
pnpm build
```

### Run unit tests

```sh
pnpm vitest run
```

## Project structure

The app was migrated from the single-screen prototype (its old `src/app/`
`state.js` + `live.js`) to a standard Vue layout. vue-router owns navigation with
`createWebHashHistory`, so the `#/...` URLs are unchanged.

```
src/
├── main.js                 # createApp + pinia + router; startApp() bootstraps before mount
├── App.vue                 # top bar / portal shell + app-wide notification toaster
├── router/
│   ├── index.js            # routes + guard (createWebHashHistory, #/... scheme)
│   ├── nav.js              # HOME map + setRouter() used by ui-store nav actions
│   └── sync.js             # keeps the ui-store tab/page in step with the URL
├── stores/                 # Pinia stores (ported from the old app/state.js; used directly by components)
│   ├── pinia.js            # the Pinia instance
│   ├── session.js          # who is signed in (guard's source of truth)
│   ├── catalog.js          # profiles / venues / stores / menu
│   ├── orders.js           # cart + orders + deliveries
│   ├── ui.js               # tabs, page + sheet overlays (item/pay/venue)
│   ├── auth.js             # Supabase auth session (for realtime notifications)
│   └── notifications.js    # notification history + unread count
├── composables/
│   ├── useAppBootstrap.js  # loading, polling, clock, title (non-routing half of old live.js)
│   ├── useWaitTime.js      # realtime wait-time estimate (poll fallback)
│   ├── useStoreOrdersLive.js # realtime merchant order board (poll fallback)
│   ├── useRealtimeNotifications.js # realtime per-user toasts + history (poll fallback)
│   ├── notifyBridge.js     # relocated from app/
│   └── realtimeAuthBridge.js # relocated from app/
├── layouts/                # StudentLayout, StaffLayout, StudentTabView
├── views/                  # route components (student/, merchant/, admin/, SignIn, Notifications, NotFound)
├── portals/                # sheet/overlay + map components (item/pay/venue sheets, maps, cards)
├── components/             # shared UI (Icon, Mono, Avatar, WaitChip, OrderRow, ReceiptPanel, Notification*…)
├── common/supabase.js      # Supabase client; exports null (console.warn, no throw) when env is missing
├── services/api.js         # Express API calls (axios)
├── utils/                  # pure helpers (engine, waitTime, mapApi, eta, format…)
└── config/                 # app name, poll interval, map tiles, opening-hours rule
```

Pages/tabs are routes; the item/pay/venue sheets stay as ui-store overlays, not
routes. The polling and realtime notification paths are both kept (not
de-duplicated). See `../LiveTrackingFeatures.md` for the realtime behaviour.

## Styling conventions

- **One global stylesheet:** `src/assets/main.css` holds only genuinely global
  styling — the `:root` design tokens, the `.site`/`.app` Bootstrap-variable
  (`--bs-*`) theming, base `html/body/#app` resets, fonts, and the small
  cross-area shared helpers (`.scroll`, `.mono`, `.avatar`, `.panel`, `.chip`,
  `.tag`, …). It is imported once in `main.js`, after Bootstrap, so our theme wins.
- **Prefer Bootstrap** utilities/components (spacing, flex, grid, buttons, cards,
  badges, tables) in templates instead of hand-rolled CSS wherever they match.
- **Component-specific CSS** belongs in that component's `<style scoped>` block.
  Use `:deep()` when a parent must style a child component's internals (a plain
  scoped rule won't reach across the `data-v-` boundary). Keep Vue `<Transition>`
  animation classes and shared tokens global.
- Reserve custom CSS for the genuinely bespoke bits Bootstrap can't express (the
  brand palette, the phone-frame shell, the kitchen board, sheet/page
  transitions, the map, the status timeline).

> Migration note: the heavy prototype stylesheet `app.css` was consolidated into
> `main.css` (and the dead `style.css` / `style/main.css` removed). Relocating the
> remaining per-screen rules out of `main.css` into scoped component blocks is an
> ongoing, area-by-area effort — new/edited components should already follow the
> conventions above.
