import { config as cfg } from '@/config/index.js'

const PREFIX = 'delivery-chat:'
const PHONE = /\+?\d[\d\s().-]{6,}\d/g
const STATUSES = ['sending', 'sent', 'failed']

export const MAX_CHAT_LENGTH = 500
export const MAX_STORED = 200
export const CHAT_STATUSES = ['accepted', 'picked_up', 'delivered']

export function maskContact(text) {
  return String(text ?? '').replace(PHONE, '••••')
}

export function cleanMessage(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null
  const text = maskContact(String(raw.text ?? '').trim().slice(0, MAX_CHAT_LENGTH))
  if (!text) return null
  const at = Date.parse(raw.at)
  return {
    id: raw.id.slice(0, 64),
    from: raw.from === 'courier' ? 'courier' : 'customer',
    text,
    at: Number.isFinite(at) ? new Date(at).toISOString() : new Date().toISOString(),
  }
}

export function chatClosesAt(deliveredAt) {
  return deliveredAt ? deliveredAt + cfg.chatOpenAfterDeliveryMin * 60e3 : null
}

export function chatAvailable(delivery, now) {
  if (!delivery || !delivery.courier_id || !CHAT_STATUSES.includes(delivery.status)) return false
  const closesAt = chatClosesAt(delivery.delivered_at)
  return !closesAt || now < closesAt
}

export function loadChat(deliveryId) {
  try {
    const list = JSON.parse(sessionStorage.getItem(PREFIX + deliveryId) || '[]')
    if (!Array.isArray(list)) return []
    return list
      .map((m) => {
        const clean = cleanMessage(m)
        if (!clean) return null
        if (!STATUSES.includes(m.status)) return clean
        return { ...clean, status: m.status === 'sending' ? 'failed' : m.status }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export function saveChat(deliveryId, messages) {
  try {
    sessionStorage.setItem(PREFIX + deliveryId, JSON.stringify(messages.slice(-MAX_STORED)))
  } catch {
    return
  }
}

export function clearChat(deliveryId) {
  try {
    sessionStorage.removeItem(PREFIX + deliveryId)
  } catch {
    return
  }
}
