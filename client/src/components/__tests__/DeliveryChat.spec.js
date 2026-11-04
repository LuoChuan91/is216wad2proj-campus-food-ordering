import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('@/composables/useDeliveryChat.js', () => ({
  useDeliveryChat: () => ({
    messages: ref([{ id: 'a', from: 'courier', text: 'On my way', at: new Date().toISOString() }]),
    state: ref('live'),
    error: ref(''),
    send: vi.fn(),
    retry: vi.fn(),
  }),
}))

import DeliveryChat from '../DeliveryChat.vue'

const Icon = { template: '<i />' }

function mountChat() {
  return mount(DeliveryChat, {
    props: { deliveryId: 'd1', me: 'customer', title: 'Chat with your courier' },
    global: { components: { Icon } },
    attachTo: document.body,
  })
}

describe('DeliveryChat', () => {
  afterEach(() => { document.body.innerHTML = ''; document.body.className = '' })

  it('opens as a popup that is centred on larger screens and full screen on phones', async () => {
    const wrapper = mountChat()
    expect(document.querySelector('.chat-modal')).toBeNull()
    await wrapper.find('.chat-trigger').trigger('click')
    const dialog = document.querySelector('.chat-modal .modal-dialog')
    expect(dialog.classList).toContain('modal-dialog-centered')
    expect(dialog.classList).toContain('modal-fullscreen-md-down')
    expect(document.querySelector('.chat-modal').textContent).toContain('On my way')
    expect(document.body.classList).toContain('modal-open')
    wrapper.unmount()
  })

  it('closes with the close button and with Escape', async () => {
    const wrapper = mountChat()
    await wrapper.find('.chat-trigger').trigger('click')
    document.querySelector('.chat-modal .btn-close').click()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.chat-modal')).toBeNull()

    await wrapper.find('.chat-trigger').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.chat-modal')).toBeNull()
    expect(document.body.classList).not.toContain('modal-open')
    wrapper.unmount()
  })
})
