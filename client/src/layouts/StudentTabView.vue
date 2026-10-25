<script setup>
// Placeholder for student TAB routes (explore/stores/orders/deliver/me).
//
// The tab screens render in StudentLayout's persistent KeepAlive layer (so the
// Leaflet map survives navigation), not through <RouterView>. The router still
// needs a component for each tab route — this renders nothing, leaving only the
// persistent tab layer visible. Full-page routes (store/checkout/track) use their
// real page components instead.
</script>

<template><span class="tab-route-noop" aria-hidden="true" hidden /></template>
