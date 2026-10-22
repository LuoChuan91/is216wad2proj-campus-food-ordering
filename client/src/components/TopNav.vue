<script setup>
// The top bar: app name, clock, notifications and the account menu
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui.js'
import { useOrdersStore } from '@/stores/orders.js'
import { useSessionStore } from '@/stores/session.js'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { ROLE } from '@/composables/useAppBootstrap.js'
import { useNotificationsStore } from '@/stores/notifications.js'
import NotificationPanel from '@/components/NotificationPanel.vue'

const ui = useUiStore()
const orders = useOrdersStore()
const session = useSessionStore()
const { online, now, menu } = storeToRefs(ui)

const me = computed(() => orders.me())

// Angel's notifications store drives the bell panel and toasts.
const notes = useNotificationsStore()
const { items } = storeToRefs(notes)
const unread = computed(() => items.value.filter((n) => !n.read).length)
</script>

<template>
  <header class="topnav">
    <div class="tn-brand"><AppMark :size="28" /><b>{{ cfg.appName }}</b><span class="tn-portal">{{ ROLE[me.role] }}</span></div>
    <span v-if="!online" class="tn-offline" role="status"><i></i>Reconnecting…</span>
    <span class="tn-clock"><Icon name="clock" :size="14" /><span class="tn-date">{{ E.dateLabel(now) }},</span>{{ E.clock(now) }}</span>
    <div class="tn-menu">
      <button type="button" class="tn-btn" aria-label="Notifications" :aria-expanded="menu === 'bell'" @click.stop="ui.toggleMenu('bell')"><Icon name="bell" :size="20" /><b v-if="unread" class="tn-dot">{{ unread }}</b></button>
      <div v-if="menu === 'bell'" class="tn-drop tn-bell">
        <h6>Notifications</h6>
        <NotificationPanel />
      </div>
    </div>
    <div class="tn-menu">
      <button type="button" class="tn-acct" aria-label="Account menu" :aria-expanded="menu === 'account'" @click.stop="ui.toggleMenu('account')"><Avatar :name="me.name" :size="30" :tone="me.role === 'student' ? 'brand' : 'navy'" /><span class="tn-name">{{ me.name }}</span><Icon name="chevD" :size="16" /></button>
      <div v-if="menu === 'account'" class="tn-drop">
        <div class="tn-me"><strong>{{ me.name }}</strong><small>{{ me.email }}</small><span class="tag">{{ ROLE[me.role] }}</span></div>
        <button type="button" class="tn-item" @click="session.signOut()"><Icon name="logout" :size="18" /><span>Switch account<small>Back to the sign-in page</small></span></button>
      </div>
    </div>
  </header>
</template>


<style scoped>
/* Top bar + its dropdowns (moved from the global prototype stylesheet).
   @keyframes live stays global (shared with the tracking page). :deep() is used
   where a rule targets a child component's internals (Avatar, Icon). */
.topnav {
  height: var(--nav-h);
  flex: none;
  position: relative;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 14px 0 18px;
  background: var(--navy);
  color: #fff;
}
.tn-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-right: auto;
  min-width: 0;
}
.tn-brand b {
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tn-portal {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #dfe4f7;
}
.tn-clock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #cfd6f1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tn-offline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #ffd8cc;
}
.tn-offline i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand);
  animation: live 1.4s infinite;
}
.tn-menu {
  position: relative;
}
.tn-btn,
.tn-acct {
  border: 0;
  background: transparent;
  color: #fff;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.tn-btn {
  width: 40px;
  height: 40px;
  justify-content: center;
  position: relative;
}
.tn-acct {
  padding: 4px 8px 4px 4px;
  font-weight: 700;
  font-size: 14px;
}
.tn-acct :deep(.avatar.av-navy) {
  background: rgba(255, 255, 255, 0.2);
}
.tn-btn:hover,
.tn-acct:hover,
.tn-btn[aria-expanded="true"],
.tn-acct[aria-expanded="true"] {
  background: rgba(255, 255, 255, 0.12);
}
.tn-btn:focus-visible,
.tn-acct:focus-visible {
  outline: 3px solid rgba(255, 255, 255, 0.5);
  outline-offset: 1px;
}
.tn-dot {
  position: absolute;
  top: 3px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--brand);
  color: #fff;
  font-size: 11px;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 2px var(--navy);
}
.tn-drop {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 300px;
  max-height: calc(100vh - var(--nav-h) - 24px);
  overflow-y: auto;
  background: var(--paper);
  color: var(--ink);
  border-radius: 16px;
  box-shadow:
    0 18px 50px rgba(20, 24, 40, 0.28),
    0 0 0 1px rgba(20, 24, 40, 0.06);
  padding: 8px;
  font-size: 13.5px;
}
.tn-drop h6 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 6px 8px 6px;
  font-weight: 800;
}
.tn-bell {
  width: 340px;
}
.tn-note {
  display: grid;
  grid-template-columns: 10px 1fr;
  gap: 10px;
  padding: 8px;
  border-radius: 12px;
}
.tn-note + .tn-note {
  border-top: 1px solid var(--line);
  border-radius: 0;
}
.tn-note i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  background: var(--brand);
}
.tn-note.tone-ok i {
  background: var(--ok);
}
.tn-note.tone-warn i {
  background: #e5a019;
}
.tn-note.tone-info i {
  background: var(--info);
}
.tn-note strong {
  display: block;
  font-size: 13.5px;
}
.tn-note span {
  display: block;
  color: var(--ink-2);
  font-size: 12.5px;
}
.tn-note small {
  color: var(--muted);
  font-size: 11.5px;
}
.tn-me {
  padding: 8px 10px 10px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 4px;
}
.tn-me strong {
  display: block;
  font-size: 15px;
}
.tn-me small {
  display: block;
  color: var(--muted);
  margin-bottom: 6px;
  word-break: break-all;
}
.tn-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  border: 0;
  background: none;
  text-align: left;
  padding: 9px 10px;
  border-radius: 10px;
  color: var(--ink);
  font-weight: 700;
  cursor: pointer;
}
.tn-item :deep(.ic) {
  margin-top: 1px;
  color: var(--ink-2);
}
.tn-item small {
  display: block;
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
}
.tn-item:hover {
  background: var(--canvas);
}
.tn-item.danger {
  background: var(--late-soft);
  color: var(--late);
}
.tn-item.danger :deep(.ic) {
  color: var(--late);
}
</style>
