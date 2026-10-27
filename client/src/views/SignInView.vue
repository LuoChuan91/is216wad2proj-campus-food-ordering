<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import AuthPanel from '@/components/AuthPanel.vue'

const ui = useUiStore()
const { now } = storeToRefs(ui)
</script>

<template>
  <div class="signin">
    <div class="si-wrap container">
      <div class="row g-4 g-lg-5 justify-content-center align-items-start">
      <section class="si-hero col-12 col-md-10 col-lg-6 col-xl-7">
        <div class="si-brand"><AppMark :size="52" /><div><h1>{{ cfg.appName }}</h1><p>{{ cfg.tagline }}</p></div></div>
        <p class="si-lead">Order from SMU food stores, skip the queue, or bring a classmate's lunch over between lessons and keep the delivery fee.</p>
        <ul class="si-points list-unstyled d-none d-lg-grid gap-3 mb-4">
          <li class="d-flex align-items-center gap-3"><span class="d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="map" :size="18" /></span>Find food on the campus map, with walking times and live waits</li>
          <li class="d-flex align-items-center gap-3"><span class="d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="clock" :size="18" /></span>Honest ready times, worked out from each kitchen's queue</li>
          <li class="d-flex align-items-center gap-3"><span class="d-flex align-items-center justify-content-center flex-shrink-0"><Icon name="bike" :size="18" /></span>Peer delivery by verified SMU students</li>
        </ul>
      </section>
      <div class="col-12 col-md-10 col-lg-6 col-xl-5">
      <section class="si-card">
        <h2>Sign in</h2>
        <AuthPanel />
      </section>
      </div>
      </div>
    </div>
    <footer class="si-foot d-flex justify-content-center align-items-center flex-wrap gap-3">
      <span class="d-inline-flex align-items-center gap-1"><Icon name="clock" :size="13" />{{ E.dateLabel(now) }}, {{ E.clock(now) }} in Singapore</span>
    </footer>
  </div>
</template>


<style scoped>
/* Sign-in page (moved from the global prototype stylesheet). */
.signin {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    180deg,
    var(--navy) 0,
    var(--navy) 300px,
    var(--canvas) 300px
  );
}
.si-wrap {
  flex: 1;
  padding: 56px 24px 24px;
}
.si-hero {
  color: #fff;
  padding-top: 8px;
}
.si-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 26px;
}
.si-brand h1 {
  font-family: var(--font-display);
  font-size: 46px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  margin: 0 0 6px;
  color: #fff;
}
.si-brand p {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #dfe4f7;
}
.si-lead {
  font-size: 17px;
  line-height: 1.55;
  color: #dfe4f7;
  max-width: 470px;
  margin: 0 0 30px;
}
.si-points {
  color: var(--ink);
  max-width: 470px;
}
.si-points li {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px 14px;
  font-weight: 600;
  font-size: 14.5px;
}
.si-points li > span {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand);
}
.si-card {
  background: var(--paper);
  border-radius: 24px;
  padding: 26px 24px 20px;
  box-shadow:
    0 24px 60px rgba(20, 24, 40, 0.18),
    0 0 0 1px rgba(20, 24, 40, 0.04);
}
.si-card h2 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.01em;
}
.si-foot {
  padding: 10px 24px 22px;
  color: var(--muted);
  font-size: 12.5px;
}
</style>
