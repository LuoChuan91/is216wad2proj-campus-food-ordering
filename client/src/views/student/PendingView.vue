<script setup>
// Shown to students whose account isn't active (waiting for an admin, or blocked).
//
// Migrated from portals/student/PendingScreen.vue. Rendered by StudentLayout when
// the signed-in student's status isn't 'active'. Behaviour unchanged.
import { computed } from 'vue'
import { Q } from '@/stores/compat.js'

const me = computed(() => Q.me())
const waiting = computed(() => me.value.status === 'inactive')
const first = (name) => name.split(' ')[0]
</script>

<template>
  <div class="pending">
    <AppMark :size="64" />
    <h2 v-if="waiting">Hi {{ first(me.name) }}, you're almost in</h2>
    <h2 v-else>We couldn't verify your account</h2>
    <p v-if="waiting">We check that every account belongs to an SMU student. You'll get a notification as soon as an admin approves yours.</p>
    <p v-else>Contact the campus dining office if you think this is a mistake.</p>
    <div class="pending-card">
      <div class="pc-status" :class="waiting ? 'warn' : 'late'"><i></i>{{ waiting ? 'Waiting for approval' : me.status === 'removed' ? 'Account removed' : 'Account blocked' }}</div>
      <dl><div><dt>Email</dt><dd>{{ me.email }}</dd></div></dl>
    </div>
  </div>
</template>
