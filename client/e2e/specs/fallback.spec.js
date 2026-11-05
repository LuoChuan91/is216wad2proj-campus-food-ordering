import { test, expect } from '@playwright/test'
import { ACCOUNTS } from '../accounts.js'
import { signIn } from '../fixtures/auth.js'
import { placeE2EDeliveryOrder } from '../fixtures/order.js'
import { rest, signInToken } from '../fixtures/db.js'

const API = 'http://localhost:3000'

test('a delivery nobody accepts switches to pickup and waives the fee', async ({ page }) => {
  await signIn(page, ACCOUNTS.student)
  await placeE2EDeliveryOrder(page)

  // The order id is the last part of /student/orders/<id>
  const orderId = page.url().split('/').pop().split('?')[0]

  // 1. Force the courier window into the past
  const deliveries = await rest(`deliveries?select=id&order_id=eq.${orderId}`)
  expect(deliveries.length).toBeGreaterThan(0)
  await rest(`deliveries?id=eq.${deliveries[0].id}`, {
    method: 'PATCH',
    body: { expires_at: new Date(Date.now() - 60_000).toISOString() },
  })

  // 2. Read the order through the real API: that read runs the server's expiry
  //    check (the UI caches its order list, so it would not show the switch).
  const token = await signInToken(ACCOUNTS.student.email, ACCOUNTS.student.password)
  const profiles = await rest(`profiles?select=id&email=eq.${encodeURIComponent(ACCOUNTS.student.email)}`)
  expect(profiles.length).toBeGreaterThan(0)

  const res = await fetch(`${API}/api/orders?student_id=${profiles[0].id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok).toBeTruthy()

  const orders = await res.json()
  const order = orders.find((o) => o.id === orderId)

  expect(order, 'the order should still be listed').toBeTruthy()
  expect(order.type).toBe('pickup') // delivery -> pickup
  expect(order.fallback).toBe(true) // no courier took it
  expect(Number(order.fee_waived)).toBeGreaterThan(0) // delivery fee waived
})
