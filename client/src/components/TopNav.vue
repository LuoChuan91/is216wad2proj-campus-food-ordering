<script setup>
// The top bar: app name, clock, notifications and the account menu
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { S, Q, A } from '../app/state'
import * as E from '../app/engine'
import { config as cfg } from '../app/config'
import { ROLE } from '../app/live'
import { useNotificationsStore } from '@/stores/notifications.js'
import NotificationPanel from '@/components/NotificationPanel.vue'

const me = computed(() => Q.me())

// Angel's notifications store drives the bell panel and toasts.
const notes = useNotificationsStore()
const { items } = storeToRefs(notes)
const unread = computed(() => items.value.filter((n) => !n.read).length)
</script>

<template>
  <header class="topnav">
    <div class="tn-brand"><AppMark :size="28" /><b>{{ cfg.appName }}</b><span class="tn-portal">{{ ROLE[me.role] }}</span></div>
    <span v-if="!S.online" class="tn-offline" role="status"><i></i>Reconnecting…</span>
    <span class="tn-clock"><Icon name="clock" :size="14" /><span class="tn-date">{{ E.dateLabel(S.now) }},</span>{{ E.clock(S.now) }}</span>
    <div class="tn-menu">
      <button type="button" class="tn-btn" aria-label="Notifications" :aria-expanded="S.menu === 'bell'" @click.stop="A.toggleMenu('bell')"><Icon name="bell" :size="20" /><b v-if="unread" class="tn-dot">{{ unread }}</b></button>
      <div v-if="S.menu === 'bell'" class="tn-drop tn-bell">
        <h6>Notifications</h6>
        <NotificationPanel />
      </div>
    </div>
    <div class="tn-menu">
      <button type="button" class="tn-acct" aria-label="Account menu" :aria-expanded="S.menu === 'account'" @click.stop="A.toggleMenu('account')"><Avatar :name="me.name" :size="30" :tone="me.role === 'student' ? 'brand' : 'navy'" /><span class="tn-name">{{ me.name }}</span><Icon name="chevD" :size="16" /></button>
      <div v-if="S.menu === 'account'" class="tn-drop">
        <div class="tn-me"><strong>{{ me.name }}</strong><small>{{ me.email }}</small><span class="tag">{{ ROLE[me.role] }}</span></div>
        <button type="button" class="tn-item" @click="A.signOut()"><Icon name="logout" :size="18" /><span>Switch account<small>Back to the sign-in page</small></span></button>
      </div>
    </div>
  </header>
</template>
