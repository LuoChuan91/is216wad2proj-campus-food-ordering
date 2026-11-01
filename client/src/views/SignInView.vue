<script setup>
// Home page ('/'): hero on the left, sign-in / create account / forgot password card on the right,
// and a "How it works" strip underneath.
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import AuthPanel from '@/components/AuthPanel.vue'

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
    <div class="blob blob-a" aria-hidden="true"></div>
    <div class="blob blob-b" aria-hidden="true"></div>
    <div class="blob blob-c" aria-hidden="true"></div>

    <div class="si-wrap">
      <section class="si-hero">
        <div class="si-brand anim-rise" style="--d: 0ms">
          <AppMark :size="56" />
          <div>
            <h1>{{ cfg.appName }}</h1>
            <p>{{ cfg.tagline }}</p>
          </div>
        </div>

        <div class="pill anim-rise" style="--d: 40ms">
          <span class="pill-dot"></span>
          Live queue times across campus
        </div>

        <h2 class="si-headline anim-rise" style="--d: 120ms">
          Order from SMU food stores <span class="grad">without the queue.</span>
        </h2>
        <p class="si-lead anim-rise" style="--d: 200ms">
          Skip the line, or bring a classmate's lunch over between lessons and keep the delivery fee.
        </p>

        <ul class="si-points">
          <li
            v-for="(p, i) in perks"
            :key="p.icon"
            class="anim-slide"
            :style="{ '--d': `${320 + i * 110}ms` }"
          >
            <span class="pt-ic"><Icon :name="p.icon" :size="18" /></span>
            {{ p.text }}
          </li>
        </ul>
      </section>

      <section class="si-card anim-pop" style="--d: 180ms">
        <h2>Welcome back</h2>
        <p class="si-sub">Sign in with your SMU email, or create an account.</p>
        <AuthPanel />
      </section>
    </div>

    <section class="si-steps">
      <h3 class="anim-rise" style="--d: 500ms">How it works</h3>
      <div class="step-grid">
        <article
          v-for="(s, i) in steps"
          :key="s.title"
          class="step anim-rise"
          :style="{ '--d': `${600 + i * 120}ms` }"
        >
          <span class="step-num">{{ i + 1 }}</span>
          <span class="step-ic"><Icon :name="s.icon" :size="20" /></span>
          <h4>{{ s.title }}</h4>
          <p>{{ s.text }}</p>
        </article>
      </div>
    </section>

    <footer class="si-foot anim-fade" style="--d: 900ms">
      <span><Icon name="clock" :size="13" />{{ E.dateLabel(now) }}, {{ E.clock(now) }} in Singapore</span>
    </footer>
  </div>
</template>

<style scoped>
.signin {
  position: relative;
  isolation: isolate;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  color: #fff;
  background:
    radial-gradient(1100px 520px at 12% -12%, #2c3f80 0%, transparent 62%),
    radial-gradient(900px 500px at 100% 110%, #3a2a5c 0%, transparent 60%),
    linear-gradient(180deg, #1e2a5a 0%, #182152 55%, #141c45 100%);
}
.signin::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px);
  background-size: 22px 22px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
  mask-image: linear-gradient(180deg, #000 0%, transparent 85%);
}

/* Drifting colour blobs */
.blob {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  filter: blur(64px);
  pointer-events: none;
  animation: drift 16s ease-in-out infinite alternate;
}
.blob-a { width: 440px; height: 440px; top: -140px; right: -90px; background: #e5512d; opacity: 0.3; }
.blob-b { width: 360px; height: 360px; top: 260px; left: -150px; background: #4d7cff; opacity: 0.2; animation-duration: 20s; }
.blob-c { width: 300px; height: 300px; bottom: 80px; right: 12%; background: #ffb199; opacity: 0.18; animation-duration: 18s; }

/* Entrance animations. "backwards" applies the start state only during the delay,
   so hover effects still work afterwards. */
.anim-rise { animation: rise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) var(--d, 0ms) backwards; }
.anim-slide { animation: slide 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) var(--d, 0ms) backwards; }
.anim-pop { animation: pop 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) var(--d, 0ms) backwards; }
.anim-fade { animation: fade 0.6s ease var(--d, 0ms) backwards; }

/* Hero and card */
.si-wrap {
  flex: none;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 56px 24px 32px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
  gap: 56px;
  align-items: center;
}
.si-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 26px;
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
.pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 10px;
  margin-bottom: 18px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #dfe4f7;
  font-size: 13px;
  font-weight: 700;
}
.pill-dot {
  position: relative;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #37d68a;
}
.pill-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #37d68a;
  animation: ping 1.6s ease-out infinite;
}
.si-headline {
  font-family: var(--font-display);
  font-size: 42px;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: #fff;
  margin: 0 0 16px;
  max-width: 520px;
}
.grad {
  background: linear-gradient(90deg, #ff8a6b, #ffc36b, #ff8a6b);
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
  margin: 0 0 28px;
}
.si-points {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 12px;
  max-width: 470px;
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
  transform: translateX(5px);
  background: rgba(255, 255, 255, 0.14);
}
.pt-ic {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--brand);
  color: #fff;
  flex: none;
  box-shadow: 0 6px 16px rgba(229, 81, 45, 0.35);
}
.pt-ic::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 2px solid var(--brand);
  animation: ping 2.4s ease-out infinite;
}

/* Card */
.si-card {
  position: relative;
  color: var(--ink);
  background: var(--paper);
  border-radius: 24px;
  padding: 30px 26px 24px;
  box-shadow:
    0 30px 70px rgba(10, 16, 40, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.si-card::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--brand), #ffb347);
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
  margin: 4px 0 14px;
  font-size: 14.5px;
}

/* How it works */
.si-steps {
  flex: none;
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 8px 24px 40px;
}
.si-steps h3 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 16px;
}
.step-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.step {
  position: relative;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 22px 20px;
  color: #dfe4f7;
  transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
}
.step:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 179, 71, 0.45);
}
.step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 100%;
  width: 16px;
  height: 2px;
  margin-top: -1px;
  background-image: linear-gradient(90deg, #ffb347 50%, transparent 50%);
  background-size: 8px 2px;
  animation: dash 0.6s linear infinite;
}
.step-num {
  position: absolute;
  top: 14px;
  right: 18px;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.14);
}
.step-ic {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  color: #fff;
  background: linear-gradient(135deg, var(--brand), #ff9a6b);
  box-shadow: 0 8px 18px rgba(229, 81, 45, 0.35);
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.step:hover .step-ic {
  transform: translateY(-3px) rotate(-6deg) scale(1.05);
}
.step h4 {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 6px;
}
.step p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #c9d0ea;
}

.si-foot {
  flex: none;
  display: flex;
  justify-content: center;
  padding: 0 24px 24px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12.5px;
}
.si-foot span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* Keyframes */
@keyframes drift {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(34px, -24px) scale(1.08); }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: none; }
}
@keyframes slide {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: none; }
}
@keyframes pop {
  from { opacity: 0; transform: translateY(32px) scale(0.96); }
  to { opacity: 1; transform: none; }
}
@keyframes fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ping {
  from { transform: scale(1); opacity: 0.7; }
  to { transform: scale(2.2); opacity: 0; }
}
@keyframes dash {
  to { background-position: 8px 0; }
}
@keyframes shine {
  to { background-position: -200% 0; }
}

@media (max-width: 900px) {
  .si-wrap {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 36px 18px 16px;
  }
  .si-card {
    order: -1;
  }
  .si-headline {
    font-size: 32px;
  }
  .si-brand h1 {
    font-size: 36px;
  }
  .step-grid {
    grid-template-columns: 1fr;
  }
  .step:not(:last-child)::after {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .blob,
  .anim-rise,
  .anim-slide,
  .anim-pop,
  .anim-fade,
  .pill-dot::after,
  .pt-ic::after,
  .step:not(:last-child)::after,
  .grad {
    animation: none !important;
  }
  .si-points li,
  .step,
  .step-ic {
    transition: none;
  }
}
</style>