<script setup>
// Minimal 404 view.
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="container py-4 text-center">
    <h1 class="h4">Page not found</h1>
    <p class="text-muted">The page you are looking for does not exist.</p>
    <RouterLink to="/">Go home</RouterLink>
  </main>
</template>
