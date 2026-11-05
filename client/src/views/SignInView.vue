<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import AuthPanel from '@/components/AuthPanel.vue'
import IntroSplash from '@/components/IntroSplash.vue'

const ui = useUiStore()
const { now } = storeToRefs(ui)

const perks = [
  { icon: 'map', text: 'Find food on the campus map, with walking times and live waits' },
  { icon: 'clock', text: "Honest ready times, worked out from each kitchen's queue" },
  { icon: 'bike', text: 'Peer delivery by verified SMU students' },
]

const steps = [
  { icon: 'map', title: 'Find your food', text: 'Browse stores on the campus map and see how long each queue is.' },
  { icon: 'sparkle', title: 'Order and pay', text: 'Pick your dishes, customise them, and pay in the app.' },
  { icon: 'bike', title: 'Collect or get it delivered', text: 'Pick it up at the counter, or have a fellow student bring it to you.' },
]
</script>

<template>
  <div class="signin">
    <IntroSplash />
    <span class="blob b1" aria-hidden="true"></span>
    <span class="blob b2" aria-hidden="true"></span>

    <main class="si-wrap container">
      <div class="row g-4 g-lg-5 align-items-center">
        <section class="si-hero col-12 col-lg-6 order-2 order-lg-1">
          <div class="si-brand">
            <AppMark :size="52" />
            <div>
              <h1>{{ cfg.appName }}</h1>
              <p>{{ cfg.tagline }}</p>
            </div>
          </div>

          <span class="si-pill anim-rise" style="--d: 80ms">
            <i></i>Live queue times across campus
          </span>

          <h2 class="si-headline anim-rise" style="--d: 160ms">
            Skip the queue. <span class="grad">Eat between classes.</span>
          </h2>

          <p class="si-lead anim-rise" style="--d: 240ms">
            Order from SMU food stores, skip the queue, or bring a classmate's lunch over between lessons and keep the delivery fee.
          </p>

          <ul class="si-points list-unstyled">
            <li
              v-for="(p, i) in perks"
              :key="p.text"
              class="pt"
              :style="{ '--d': 320 + i * 110 + 'ms' }"
            >
              <span class="si-ic"><Icon :name="p.icon" :size="18" /></span>
              {{ p.text }}
            </li>
          </ul>
        </section>

        <div class="col-12 col-lg-5 offset-lg-1 order-1 order-lg-2">
          <section class="si-card anim-pop" style="--d: 200ms">
            <h2>Welcome back</h2>
            <p class="si-sub">Sign in with your SMU email to start ordering.</p>
            <AuthPanel />
          </section>
        </div>
      </div>

      <section class="si-steps">
        <h3 class="anim-fade" style="--d: 500ms">How it works</h3>
        <div class="row g-3">
          <div v-for="(s, i) in steps" :key="s.title" class="col-12 col-md-4">
            <div class="step anim-rise" :style="{ '--d': 560 + i * 120 + 'ms' }">
              <span class="step-n">{{ i + 1 }}</span>
              <span class="si-ic"><Icon :name="s.icon" :size="18" /></span>
              <h4>{{ s.title }}</h4>
              <p>{{ s.text }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="si-foot anim-fade" style="--d: 900ms">
      <span><Icon name="clock" :size="13" />{{ E.dateLabel(now) }}, {{ E.clock(now) }} in Singapore</span>
    </footer>
  </div>
</template>

<style scoped>
.signin {
  position: relative;
  isolation: isolate;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--navy);
  color: #fff;
}
/* Faint dot grid over the whole page */
.signin::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 22px 22px;
  pointer-events: none;
}
/* Soft glowing blobs that drift slowly */
.blob {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.45;
  pointer-events: none;
  animation: drift 16s ease-in-out infinite alternate;
}
.b1 {
  width: 420px;
  height: 420px;
  top: -140px;
  left: -120px;
  background: #3b5bdb;
}
.b2 {
  width: 360px;
  height: 360px;
  bottom: -120px;
  right: -100px;
  background: var(--brand);
  animation-delay: -8s;
}

.si-wrap {
  flex: 1;
  padding: 56px 24px 24px;
}
.si-hero {
  padding-top: 8px;
}
.si-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}
.si-brand h1 {
  font-family: var(--font-display);
  font-size: 44px;
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
.si-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  font-size: 13px;
  font-weight: 700;
  color: #dfe4f7;
  margin-bottom: 18px;
}
.si-pill i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7cf2b5;
  box-shadow: 0 0 0 0 rgba(124, 242, 181, 0.6);
  animation: ping 1.8s ease-out infinite;
}
.si-headline {
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0 0 14px;
  color: #fff;
}
.grad {
  background: linear-gradient(90deg, #ff8a65, #ffd27a, #ff8a65);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shine 4s linear infinite;
}
.si-lead {
  font-size: 17px;
  line-height: 1.55;
  color: #dfe4f7;
  max-width: 470px;
  margin: 0 0 26px;
}
.si-points {
  display: grid;
  gap: 12px;
  max-width: 470px;
  margin: 0;
  padding: 0;
}
.si-points li {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
  border-radius: 16px;
  padding: 12px 14px;
  font-weight: 600;
  font-size: 14.5px;
  transition: transform 0.2s ease, background 0.2s ease;
}
.si-points li:hover {
  transform: translateX(4px);
  background: rgba(255, 255, 255, 0.12);
}
/* Each row slides in once (backwards fill keeps it hidden until its delay ends) */
.si-points li.pt {
  animation: pt-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) var(--d) backwards;
}
/* Then its icon keeps pulsing and buzzing */
.si-points li.pt .si-ic {
  animation: icon-buzz 2.4s ease-in-out calc(var(--d) + 600ms) infinite;
}
.si-ic {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand);
}

.si-card {
  position: relative;
  color: var(--ink);
  background: var(--paper);
  border-radius: 24px;
  padding: 30px 26px 24px;
  box-shadow:
    0 24px 60px rgba(20, 24, 40, 0.28),
    0 0 0 1px rgba(20, 24, 40, 0.04);
}
.si-card h2 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.01em;
}
.si-sub {
  color: var(--muted);
  font-size: var(--fs-desc);
  margin: 4px 0 18px;
}

.si-steps {
  margin-top: 48px;
}
.si-steps h3 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 16px;
  color: #fff;
}
.step {
  position: relative;
  height: 100%;
  border-radius: 18px;
  padding: 20px 18px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: transform 0.2s ease, background 0.2s ease;
}
.step:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.1);
}
.step-n {
  position: absolute;
  top: 16px;
  right: 16px;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}
.step .si-ic {
  margin-bottom: 12px;
}
.step h4 {
  font-size: 15px;
  font-weight: 800;
  margin: 0 0 6px;
  color: #fff;
}
.step p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #c9d0ee;
}

.si-foot {
  display: flex;
  justify-content: center;
  padding: 20px 16px 28px;
  font-size: 13px;
  color: #aab4d6;
}
.si-foot span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Phone: the sign-in card comes first, the hero text follows */
@media (max-width: 991px) {
  .si-headline {
    font-size: 32px;
  }
  .si-brand h1 {
    font-size: 36px;
  }
  .si-brand {
    margin-bottom: 14px;
  }
}
@media (max-width: 900px) {
  .si-wrap {
    padding: 36px 18px 16px;
  }
}
@media (max-width: 400px) {
  .si-wrap {
    padding: 24px 12px 12px;
  }
  .si-card {
    padding: 20px 14px 16px;
    border-radius: 20px;
  }
}

@keyframes pt-in {
  from { opacity: 0; transform: translateX(-24px); }
  to { opacity: 1; transform: none; }
}
/* Pulse (grow and glow) with a short side-to-side buzz, then rest */
@keyframes icon-buzz {
  0%, 100% { transform: rotate(0) scale(1); box-shadow: 0 0 0 0 rgba(229, 81, 45, 0.45); }
  4% { transform: rotate(-8deg) scale(1.12); }
  8% { transform: rotate(8deg) scale(1.12); }
  12% { transform: rotate(-6deg) scale(1.1); }
  16% { transform: rotate(6deg) scale(1.1); }
  20% { transform: rotate(0) scale(1); }
  40% { box-shadow: 0 0 0 8px rgba(229, 81, 45, 0); }
  41%, 100% { box-shadow: 0 0 0 0 rgba(229, 81, 45, 0); }
}
@keyframes drift {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(40px, 30px) scale(1.08); }
}
@keyframes shine {
  to { background-position: 200% 0; }
}
@keyframes ping {
  0% { box-shadow: 0 0 0 0 rgba(124, 242, 181, 0.6); }
  80%, 100% { box-shadow: 0 0 0 10px rgba(124, 242, 181, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .blob,
  .grad,
  .si-pill i {
    animation: none;
  }
  .si-points li,
  .step {
    transition: none;
  }
  .si-points li.pt,
  .si-points li.pt .si-ic {
    animation: none;
  }
}
</style>