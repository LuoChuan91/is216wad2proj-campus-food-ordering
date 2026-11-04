import { describe, it, expect, beforeEach } from 'vitest'
import { maskContact, cleanMessage, loadChat, saveChat, clearChat, chatAvailable, MAX_CHAT_LENGTH } from '../chat.js'

describe('maskContact', () => {
  it('hides phone numbers', () => {
    expect(maskContact('call me at 9123 4567')).toBe('call me at ••••')
    expect(maskContact('+65 9123-4567 ok')).toBe('•••• ok')
  })
  it('keeps short numbers like counts and times', () => {
    expect(maskContact('at gate 3 in 5 min, 12:30')).toBe('at gate 3 in 5 min, 12:30')
  })
})

describe('cleanMessage', () => {
  it('rejects malformed payloads', () => {
    expect(cleanMessage(null)).toBeNull()
    expect(cleanMessage({ text: 'hi' })).toBeNull()
    expect(cleanMessage({ id: 'a', text: '   ' })).toBeNull()
  })
  it('keeps only known fields and caps the length', () => {
    const m = cleanMessage({ id: 'a', from: 'admin', text: 'x'.repeat(900), at: 'nope', phone: '91234567' })
    expect(Object.keys(m).sort()).toEqual(['at', 'from', 'id', 'text'])
    expect(m.from).toBe('customer')
    expect(m.text).toHaveLength(MAX_CHAT_LENGTH)
  })
})

describe('chat storage', () => {
  beforeEach(() => sessionStorage.clear())
  it('round-trips the conversation and marks interrupted sends as failed', () => {
    const at = new Date().toISOString()
    saveChat('d1', [{ id: 'a', from: 'courier', text: 'here', at }, { id: 'b', from: 'customer', text: 'ok', at, status: 'sending' }])
    expect(loadChat('d1')).toEqual([{ id: 'a', from: 'courier', text: 'here', at }, { id: 'b', from: 'customer', text: 'ok', at, status: 'failed' }])
    clearChat('d1')
    expect(loadChat('d1')).toEqual([])
  })
  it('survives corrupt storage', () => {
    sessionStorage.setItem('delivery-chat:d1', '{oops')
    expect(loadChat('d1')).toEqual([])
  })
})

describe('chatAvailable', () => {
  const now = Date.parse('2026-11-04T12:00:00Z')
  it('opens once a courier accepts', () => {
    expect(chatAvailable({ status: 'open', courier_id: null }, now)).toBe(false)
    expect(chatAvailable({ status: 'accepted', courier_id: 'c' }, now)).toBe(true)
    expect(chatAvailable({ status: 'expired', courier_id: null }, now)).toBe(false)
  })
  it('closes 15 minutes after delivery', () => {
    expect(chatAvailable({ status: 'delivered', courier_id: 'c', delivered_at: now - 14 * 60e3 }, now)).toBe(true)
    expect(chatAvailable({ status: 'delivered', courier_id: 'c', delivered_at: now - 15 * 60e3 }, now)).toBe(false)
  })
})
