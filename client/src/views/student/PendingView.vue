<script setup>
// Shown to students whose account isn't active (waiting for an admin, or blocked).
import { computed } from 'vue'
import { useOrdersStore } from '@/stores/orders.js'
import { firstName as first } from '@/utils/engine.js'

const orders = useOrdersStore()
const me = computed(() => orders.me())
const waiting = computed(() => me.value.status === 'inactive')
</script>

<template>
  <div class="pending">
    <div class="row justify-content-center mx-0">
    <div class="col-12 col-md-8 col-lg-6 px-0">
    <AppMark :size="64" />
    <h2 v-if="waiting">Hi {{ first(me.name) }}, you're almost in</h2>
    <h2 v-else>We couldn't verify your account</h2>
    <p v-if="waiting">We check that every account belongs to an SMU student. You'll get a notification as soon as an admin approves yours.</p>
    <p v-else>Contact the campus dining office if you think this is a mistake.</p>
    <div class="pending-card">
      <div class="pc-status d-flex align-items-center gap-2 fw-bold mb-2" :class="waiting ? 'warn' : 'late'"><i></i>{{ waiting ? 'Waiting for approval' : me.status === 'removed' ? 'Account removed' : 'Account blocked' }}</div>
      <dl class="d-grid gap-1 m-0"><div class="d-flex justify-content-between gap-2"><dt>Email</dt><dd>{{ me.email }}</dd></div></dl>
    </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.pending {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 72px 28px 24px;
  text-align: center;
  background: linear-gradient(180deg, #fff 0%, var(--canvas) 100%);
}
.pending .appmark {
  margin: 0 auto 18px;
}
.pending h2 {
  font-size: var(--fs-title);
  font-weight: 800;
  margin: 0 0 10px;
  text-wrap: balance;
}
.pending p {
  color: var(--ink-2);
  font-size: var(--fs-body);
  margin: 0 0 24px;
}
.pending-card {
  text-align: left;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px;
}
.pc-status i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e5a019;
  box-shadow: 0 0 0 0 rgba(229, 160, 25, 0.5);
  animation: ping 1.6s infinite;
}
.pc-status.late i {
  background: var(--late);
  animation: none;
}
@keyframes ping {
  0% {
    box-shadow: 0 0 0 0 rgba(229, 160, 25, 0.55);
  }
  80%,
  100% {
    box-shadow: 0 0 0 10px rgba(229, 160, 25, 0);
  }
}
.pending-card dl {
  font-size: var(--fs-desc);
}
.pending-card dt {
  color: var(--muted);
  font-weight: 600;
}
.pending-card dd {
  margin: 0;
  font-weight: 600;
}
</style>
