import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useDeliveryChat } from '../useDeliveryChat.js'
import { loadChat } from '@/utils/chat.js'

function fakeClient() {
  const channels = []
  return {
    channels,
    channel(name) {
      const ch = {
        name,
        handler: null,
        sent: [],
        sendResult: 'ok',
        on(type, filter, cb) { ch.handler = cb; return ch },
        subscribe(cb) { ch.statusCb = cb; cb('SUBSCRIBED'); return ch },
        async send(msg) { ch.sent.push(msg); return ch.sendResult },
      }
      channels.push(ch)
      return ch
    },
    removeChannel: vi.fn(),
  }
}

const flush = async () => { for (let i = 0; i < 5; i++) await nextTick() }

function setup({ info = { channel: 'chat:abc', role: 'customer', closes_at: null }, deliveredAt = ref(null), fail } = {}) {
  const client = fakeClient()
  const api = { deliveryChat: vi.fn(async () => { if (fail) throw fail; return info }) }
  const scope = effectScope()
  const chat = scope.run(() => useDeliveryChat(ref('d1'), deliveredAt, { client, api }))
  return { chat, client, api, scope, deliveredAt }
}

describe('useDeliveryChat', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('joins the channel the server hands out and goes live', async () => {
    const { chat, client } = setup()
    await flush()
    expect(client.channels[0].name).toBe('chat:abc')
    expect(chat.state.value).toBe('live')
    expect(chat.role.value).toBe('customer')
  })

  it('sends, receives and keeps the conversation in sessionStorage', async () => {
    const { chat, client } = setup()
    await flush()
    await chat.send('At the main entrance, call 9123 4567')
    const ch = client.channels[0]
    expect(ch.sent[0].payload.text).toBe('At the main entrance, call ••••')
    ch.handler({ payload: { id: 'x1', from: 'courier', text: 'Coming!', at: new Date().toISOString() } })
    ch.handler({ payload: { id: 'x1', from: 'courier', text: 'Coming!', at: new Date().toISOString() } })
    expect(chat.messages.value.map((m) => m.text)).toEqual(['At the main entrance, call ••••', 'Coming!'])
    expect(loadChat('d1')).toHaveLength(2)
  })

  it('restores the conversation after a page refresh', async () => {
    sessionStorage.setItem('delivery-chat:d1', JSON.stringify([{ id: 'old', from: 'courier', text: 'Hi', at: new Date().toISOString() }]))
    const { chat } = setup()
    expect(chat.messages.value.map((m) => m.text)).toEqual(['Hi'])
  })

  it('marks a message failed when the broadcast is not acknowledged, and can retry', async () => {
    const { chat, client } = setup()
    await flush()
    client.channels[0].sendResult = 'timed out'
    await chat.send('hello')
    expect(chat.messages.value[0].status).toBe('failed')
    client.channels[0].sendResult = 'ok'
    await chat.retry(chat.messages.value[0].id)
    expect(chat.messages.value[0].status).toBe('sent')
  })

  it('closes 15 minutes after delivery and forgets the conversation', async () => {
    vi.useFakeTimers()
    const { chat, client, deliveredAt } = setup()
    await flush()
    await chat.send('thanks')
    deliveredAt.value = Date.now()
    await nextTick()
    vi.advanceTimersByTime(15 * 60e3)
    expect(chat.state.value).toBe('closed')
    expect(chat.messages.value).toEqual([])
    expect(loadChat('d1')).toEqual([])
    expect(client.removeChannel).toHaveBeenCalled()
  })

  it('shows closed when the server says the chat is over', async () => {
    sessionStorage.setItem('delivery-chat:d1', JSON.stringify([{ id: 'old', from: 'courier', text: 'Hi', at: new Date().toISOString() }]))
    const err = Object.assign(new Error('This chat has closed'), { status: 410 })
    const { chat } = setup({ fail: err })
    await flush()
    expect(chat.state.value).toBe('closed')
    expect(loadChat('d1')).toEqual([])
  })

  it('leaves the channel on unmount', async () => {
    const { client, scope } = setup()
    await flush()
    scope.stop()
    expect(client.removeChannel).toHaveBeenCalledWith(client.channels[0])
  })
})
