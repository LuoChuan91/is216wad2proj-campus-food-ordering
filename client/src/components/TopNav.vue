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
