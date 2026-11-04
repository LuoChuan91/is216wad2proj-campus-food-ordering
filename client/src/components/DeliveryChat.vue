<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, useId, watch } from 'vue'
import * as E from '@/utils/engine.js'
import { config as cfg } from '@/config/index.js'
import { MAX_CHAT_LENGTH } from '@/utils/chat.js'
import { useDeliveryChat } from '@/composables/useDeliveryChat.js'

const props = defineProps({
  deliveryId: { type: String, required: true },
  deliveredAt: { type: Number, default: null },
  me: { type: String, required: true },
  title: { type: String, default: 'Chat' },
})

const { messages, state, error, send, retry } = useDeliveryChat(
  () => props.deliveryId,
  () => props.deliveredAt,
)

const titleId = `chat-title-${useId()}`
const other = computed(() => (props.me === 'courier' ? 'customer' : 'courier'))
const open = ref(false)
const draft = ref('')
const log = ref(null)
const input = ref(null)
const trigger = ref(null)
const seen = ref(messages.value.length)

const unread = computed(() =>
  open.value ? 0 : messages.value.slice(seen.value).filter((m) => m.from === other.value).length,
)

const STATE_TEXT = { connecting: 'Connecting…', live: 'Live', offline: 'Reconnecting…', closed: 'Closed', error: 'Unavailable' }
const stateText = computed(() => STATE_TEXT[state.value] || '')
const canSend = computed(() => state.value === 'live')
const emptyText = computed(() =>
  props.me === 'courier' ? 'Say hi to your customer, or let them know you’re on the way.' : 'Message your courier about your drop-off.',
)

function scrollDown() {
  nextTick(() => { if (log.value) log.value.scrollTop = log.value.scrollHeight })
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

function show() {
  open.value = true
}

function close() {
  open.value = false
}

watch(() => messages.value.length, (n) => {
  if (open.value) { seen.value = n; scrollDown() }
})

watch(open, (isOpen) => {
  document.body.classList.toggle('modal-open', isOpen)
  if (isOpen) {
    document.addEventListener('keydown', onKey)
    seen.value = messages.value.length
    scrollDown()
    nextTick(() => { if (input.value && !input.value.disabled) input.value.focus() })
  } else {
    document.removeEventListener('keydown', onKey)
    nextTick(() => { if (trigger.value) trigger.value.focus() })
  }
})

onDeactivated(close)

onBeforeUnmount(() => {
  if (open.value) document.body.classList.remove('modal-open')
  document.removeEventListener('keydown', onKey)
})

async function submit() {
  const text = draft.value
  if (!text.trim() || !canSend.value) return
  draft.value = ''
  await send(text)
}
</script>

<template>
  <div class="panel chat">
    <button ref="trigger" type="button"
      class="chat-trigger d-flex align-items-center gap-2 w-100 p-0 border-0 bg-transparent text-start"
      aria-haspopup="dialog" @click="show">
      <Icon name="chat" :size="18" />
      <strong class="flex-grow-1">{{ title }}</strong>
      <span v-if="unread" class="badge rounded-pill text-bg-danger">{{ unread }}</span>
      <small class="chat-state" :class="'s-' + state">{{ stateText }}</small>
      <Icon name="chevR" :size="16" />
    </button>

    <Teleport to="body">
      <template v-if="open">
        <div class="modal d-block chat-modal" tabindex="-1" role="dialog" aria-modal="true" :aria-labelledby="titleId"
          @click.self="close">
          <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-md-down">
            <div class="modal-content">
              <div class="modal-header gap-2">
                <Icon name="chat" :size="20" />
                <div class="flex-grow-1 overflow-hidden">
                  <h5 :id="titleId" class="modal-title fs-6 fw-bold m-0">{{ title }}</h5>
                  <small class="chat-state" :class="'s-' + state">{{ stateText }}</small>
                </div>
                <button type="button" class="btn-close" aria-label="Close chat" @click="close"></button>
              </div>

              <div ref="log" class="modal-body chat-log d-flex flex-column gap-2" role="log" aria-live="polite">
                <p v-if="state === 'closed'" class="small text-body-secondary text-center m-auto">This chat has closed.</p>
                <template v-else>
                  <p v-if="state === 'error'" class="small text-danger m-0">{{ error }}</p>
                  <p v-if="!messages.length" class="small text-body-secondary text-center m-auto">{{ emptyText }}</p>
                  <div v-for="m in messages" :key="m.id" class="bubble px-3 py-2"
                    :class="m.from === me ? 'mine align-self-end' : 'theirs align-self-start'">
                    <span class="d-block fs-6">{{ m.text }}</span>
                    <small class="d-block">
                      {{ m.from === me ? 'You' : m.from === 'courier' ? 'Courier' : 'Customer' }} · {{ E.clock(Date.parse(m.at)) }}<template
                        v-if="m.status === 'sending'"> · Sending…</template>
                    </small>
                    <button v-if="m.status === 'failed'" type="button" class="btn btn-link btn-sm p-0 retry"
                      :disabled="!canSend" @click="retry(m.id)">Not sent · Retry</button>
                  </div>
                </template>
              </div>

              <div v-if="state !== 'closed'" class="modal-footer d-block">
                <form class="d-flex gap-2" @submit.prevent="submit">
                  <input ref="input" v-model="draft" class="form-control" type="text" :maxlength="MAX_CHAT_LENGTH"
                    :placeholder="canSend ? 'Type a message' : stateText" aria-label="Message" :disabled="!canSend" />
                  <button type="submit" class="btn btn-primary px-3" :disabled="!canSend || !draft.trim()">Send</button>
                </form>
                <small class="d-block mt-2 note">Phone numbers are hidden. This chat closes {{ cfg.chatOpenAfterDeliveryMin }} min after delivery and isn't saved.</small>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-backdrop show"></div>
      </template>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-trigger {
  color: var(--ink);
  font-size: var(--fs-body);
}

.chat-trigger:hover strong {
  color: var(--brand-600);
}

.chat-state {
  font-size: var(--fs-caption);
  font-weight: 700;
  color: var(--muted);
}

.chat-state.s-live {
  color: var(--ok);
}

.chat-state.s-offline,
.chat-state.s-error {
  color: var(--warn);
}

.chat-log {
  background: var(--canvas);
}

@media (min-width: 768px) {
  .chat-modal .modal-content {
    height: min(640px, calc(100vh - 3.5rem));
  }
}

.bubble {
  max-width: 80%;
  border-radius: 16px;
  overflow-wrap: anywhere;
}

.bubble small {
  font-size: var(--fs-caption);
  opacity: 0.75;
  margin-top: 2px;
}

.bubble.mine {
  background: var(--brand);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble.theirs {
  background: var(--paper);
  border: 1px solid var(--line);
  color: var(--ink);
  border-bottom-left-radius: 4px;
}

.bubble.mine .retry {
  color: #fff;
  font-size: var(--fs-caption);
}

.note {
  font-size: var(--fs-caption);
  color: var(--muted);
}
</style>
