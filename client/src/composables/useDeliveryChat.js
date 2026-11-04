import { ref, watch, toValue, onScopeDispose } from 'vue'
import defaultClient from '@/common/supabase.js'
import { api as defaultApi } from '@/services/api.js'
import { CONNECTED_STATUS, DOWN_STATUSES } from './realtime/channels.js'
import { cleanMessage, loadChat, saveChat, clearChat, chatClosesAt } from '@/utils/chat.js'

export const CHAT_EVENT = 'message'

export function useDeliveryChat(deliveryId, deliveredAt, { client = defaultClient, api = defaultApi } = {}) {
  const messages = ref([])
  const role = ref(null)
  const state = ref('idle')
  const error = ref('')
  let channel = null
  let timer = null
  let currentId = null
  let closesAt = null

  const persist = () => { if (currentId) saveChat(currentId, messages.value) }

  function receive(raw) {
    const msg = cleanMessage(raw)
    if (!msg || messages.value.some((m) => m.id === msg.id)) return
    messages.value.push(msg)
    persist()
  }

  function leave() {
    clearTimeout(timer)
    timer = null
    if (channel && client) client.removeChannel(channel)
    channel = null
  }

  function close() {
    leave()
    if (currentId) clearChat(currentId)
    messages.value = []
    state.value = 'closed'
  }

  function scheduleClose(at) {
    if (!at || state.value === 'closed') return
    closesAt = at
    clearTimeout(timer)
    const wait = at - Date.now()
    if (wait <= 0) close()
    else timer = setTimeout(close, wait)
  }

  async function open(id) {
    leave()
    currentId = id || null
    closesAt = null
    role.value = null
    error.value = ''
    messages.value = id ? loadChat(id) : []
    if (!id) { state.value = 'idle'; return }
    if (!client) { state.value = 'error'; error.value = "Chat isn't available right now"; return }

    state.value = 'connecting'
    try {
      const info = await api.deliveryChat(id)
      if (currentId !== id) return
      role.value = info.role
      const ch = client.channel(info.channel, { config: { broadcast: { ack: true } } })
      ch.on('broadcast', { event: CHAT_EVENT }, ({ payload }) => receive(payload))
      channel = ch
      ch.subscribe((status) => {
        if (channel !== ch || state.value === 'closed') return
        if (status === CONNECTED_STATUS) state.value = 'live'
        else if (DOWN_STATUSES.includes(status)) state.value = 'offline'
      })
      scheduleClose(info.closes_at ? Date.parse(info.closes_at) : chatClosesAt(toValue(deliveredAt)))
    } catch (e) {
      if (currentId !== id) return
      if (e.status === 410) close()
      else { state.value = 'error'; error.value = e.message }
    }
  }

  async function deliver(msg) {
    const ch = channel
    let result
    try {
      result = ch ? await ch.send({ type: 'broadcast', event: CHAT_EVENT, payload: msg }) : 'error'
    } catch {
      result = 'error'
    }
    const saved = messages.value.find((m) => m.id === msg.id)
    if (saved) saved.status = result === 'ok' ? 'sent' : 'failed'
    persist()
    return result === 'ok'
  }

  async function send(text) {
    if (!channel || !role.value || state.value !== 'live') return false
    const msg = cleanMessage({ id: crypto.randomUUID(), from: role.value, text, at: new Date().toISOString() })
    if (!msg) return false
    messages.value.push({ ...msg, status: 'sending' })
    persist()
    return deliver(msg)
  }

  async function retry(id) {
    const saved = messages.value.find((m) => m.id === id && m.status === 'failed')
    if (!saved || !channel || state.value !== 'live') return false
    saved.status = 'sending'
    const { status, ...msg } = saved
    return deliver(msg)
  }

  watch(() => toValue(deliveryId), open, { immediate: true })
  watch(() => toValue(deliveredAt), (at) => scheduleClose(chatClosesAt(at)))

  onScopeDispose(() => {
    leave()
    if (currentId && closesAt && Date.now() >= closesAt) clearChat(currentId)
  })

  return { messages, role, state, error, send, retry, close }
}
