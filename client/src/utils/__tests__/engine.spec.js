// Pure unit tests for utils/engine.js - the framework-free pricing, option-rule,
// time, distance and opening-hours logic shared by the student flow. No Vue, no
// stores: every function is exercised directly with fixed inputs.
import { describe, it, expect } from 'vitest'
import * as E from '../engine.js'

// ---- fixtures -------------------------------------------------------------
const singleRequired = { id: 'g1', name: 'Rice', type: 'single', required: true, min_select: 1, max_select: 1 }
const singleOptional = { id: 'g2', name: 'Sauce', type: 'single', required: false, min_select: 0, max_select: 1 }
const multiOptional = { id: 'g3', name: 'Toppings', type: 'multi', required: false, min_select: 0, max_select: 2 }
const multiRequired = { id: 'g4', name: 'Sides', type: 'multi', required: true, min_select: 1, max_select: 3 }

const options = [
  { id: 'o1', group_id: 'g1', name: 'White Rice', price_delta: 0, available: true },
  { id: 'o2', group_id: 'g1', name: 'Brown Rice', price_delta: 0.5, available: true },
  { id: 'o3', group_id: 'g3', name: 'Tamago', price_delta: 1, available: true },
  { id: 'o4', group_id: 'g3', name: 'Seaweed', price_delta: 0.5, available: true },
]

describe('money / round2 / sum', () => {
  it('round2 rounds to two decimals', () => {
    expect(E.round2(1.005)).toBe(1.01)
    expect(E.round2(2.345)).toBe(2.35)
  })
  it('money formats with a dollar sign and two decimals', () => {
    expect(E.money(6)).toBe('$6.00')
    expect(E.money(7.5)).toBe('$7.50')
    expect(E.money('bad')).toBe('$0.00')
  })
  it('sum adds a projected field', () => {
    expect(E.sum([{ n: 1 }, { n: 2 }, { n: 3 }], (x) => x.n)).toBe(6)
    expect(E.sum([], (x) => x.n)).toBe(0)
  })
})

describe('rule', () => {
  it('single groups always allow exactly one, required ones need one', () => {
    expect(E.rule(singleRequired)).toEqual({ min: 1, max: 1 })
    expect(E.rule(singleOptional)).toEqual({ min: 0, max: 1 })
  })
  it('multi groups use their min/max; required raises min to at least 1', () => {
    expect(E.rule(multiOptional)).toEqual({ min: 0, max: 2 })
    expect(E.rule(multiRequired)).toEqual({ min: 1, max: 3 })
  })
})

describe('ruleLabel', () => {
  it('describes single groups', () => {
    expect(E.ruleLabel(singleRequired)).toBe('Required · pick 1')
    expect(E.ruleLabel(singleOptional)).toBe('Optional · pick 1')
  })
  it('describes multi groups', () => {
    expect(E.ruleLabel(multiOptional)).toBe('Optional · up to 2')
    expect(E.ruleLabel(multiRequired)).toBe('Required · pick 1 to 3')
    expect(E.ruleLabel({ ...multiRequired, min_select: 2, max_select: 2 })).toBe('Required · pick 2')
  })
})

describe('groupStatus', () => {
  it('reports a required single group as not ok until one is chosen', () => {
    const empty = E.groupStatus(singleRequired, options, [])
    expect(empty).toMatchObject({ count: 0, ok: false, full: false })
    expect(empty.hint).toBe('Choose a rice')
    const chosen = E.groupStatus(singleRequired, options, ['o1'])
    expect(chosen).toMatchObject({ count: 1, ok: true, full: true, hint: '' })
  })

  it('reports multi progress and a pluralised "pick N more" hint', () => {
    const none = E.groupStatus(multiRequired, options, [])
    expect(none.count).toBe(0)
    expect(none.hint).toBe('Pick 1 more side')
    // Needing two with one chosen (o3 is a g3 option, so for a g3-based group).
    const needTwo = E.groupStatus({ ...multiOptional, required: true, min_select: 2 }, options, ['o3'])
    expect(needTwo.count).toBe(1)
    expect(needTwo.hint).toBe('Pick 1 more topping')
  })

  it('marks a group full at its max', () => {
    const full = E.groupStatus(multiOptional, options, ['o3', 'o4'])
    expect(full).toMatchObject({ count: 2, ok: true, full: true })
  })
})

describe('validate', () => {
  const groups = [singleRequired, multiOptional]
  it('is not ok until every required group is satisfied', () => {
    const bad = E.validate(groups, options, [])
    expect(bad.ok).toBe(false)
    expect(bad.hint).toBeTruthy()
  })
  it('is ok once the required single group has a pick', () => {
    const good = E.validate(groups, options, ['o1'])
    expect(good.ok).toBe(true)
    expect(good.byGroup.g1.ok).toBe(true)
  })
})

describe('unitPrice & snapshot', () => {
  const item = { price: 6 }
  it('adds the price deltas of the selected options', () => {
    expect(E.unitPrice(item, options, [])).toBe(6)
    expect(E.unitPrice(item, options, ['o2'])).toBe(6.5)
    expect(E.unitPrice(item, options, ['o2', 'o3'])).toBe(7.5)
  })
  it('snapshot describes the chosen options grouped by their group', () => {
    const snap = E.snapshot([singleRequired, multiOptional], options, ['o2', 'o3'])
    expect(snap).toEqual([
      { option_id: 'o2', group_name: 'Rice', name: 'Brown Rice', price_delta: 0.5 },
      { option_id: 'o3', group_name: 'Toppings', name: 'Tamago', price_delta: 1 },
    ])
  })
})

describe('discounts', () => {
  const pct = { discount_type: 'percentage', discount_per: 10 }
  const dol = { discount_type: 'dollar', discount_dol: 2 }
  it('percentage discount applies to the subtotal', () => {
    expect(E.discountFor(pct, 20)).toBe(2)
  })
  it('dollar discount is capped at the subtotal', () => {
    expect(E.discountFor(dol, 20)).toBe(2)
    expect(E.discountFor(dol, 1.5)).toBe(1.5)
  })
  it('no discount for a null store or no discount type', () => {
    expect(E.discountFor(null, 20)).toBe(0)
    expect(E.discountFor({}, 20)).toBe(0)
  })
  it('labels read naturally', () => {
    expect(E.discountLabel(pct)).toBe('10% student discount')
    expect(E.discountLabel(dol)).toBe('$2.00 off')
    expect(E.discountShort(pct)).toBe('10% off')
    expect(E.discountShort(null)).toBe('')
  })
})

describe('totals', () => {
  const lines = [{ unit_price: 6, qty: 2 }, { unit_price: 3, qty: 1 }] // subtotal 15
  const store = { discount_type: 'percentage', discount_per: 10 }
  it('applies the discount to food and adds the delivery fee only for delivery', () => {
    const pickup = E.totals(lines, store, 'pickup', 0.8)
    expect(pickup).toEqual({ subtotal: 15, discount: 1.5, delivery_fee: 0, total: 13.5 })
    const delivery = E.totals(lines, store, 'delivery', 0.8)
    expect(delivery).toEqual({ subtotal: 15, discount: 1.5, delivery_fee: 0.8, total: 14.3 })
  })
  it('never discounts the delivery fee', () => {
    const t = E.totals(lines, store, 'delivery', 0.8)
    // discount (1.5) is 10% of 15 only, not of 15.8
    expect(t.discount).toBe(1.5)
  })
})

// ---- time helpers (Singapore time, fixed epoch inputs) --------------------
describe('time helpers', () => {
  // 2026-01-05 is a Monday. 2026-01-05T04:35:00Z == 12:35 SGT (UTC+8).
  const noonish = Date.UTC(2026, 0, 5, 4, 35, 0)

  it('parts decomposes an epoch into SGT fields', () => {
    const p = E.parts(noonish)
    expect(p).toMatchObject({ y: 2026, mo: 1, d: 5, day: 'mon', h: 12, m: 35 })
  })
  it('clock formats 12-hour SGT time', () => {
    expect(E.clock(noonish)).toBe('12:35 pm')
    expect(E.clock(Date.UTC(2026, 0, 5, 0, 5, 0))).toBe('8:05 am') // 08:05 SGT
  })
  it('hhmm formats an HH:MM string into 12-hour time', () => {
    expect(E.hhmm('08:00')).toBe('8:00 am')
    expect(E.hhmm('20:30')).toBe('8:30 pm')
    expect(E.hhmm('00:15')).toBe('12:15 am')
  })
  it('dateLabel and ymd read from the SGT date', () => {
    expect(E.dateLabel(noonish)).toBe('Mon 5 Jan')
    expect(E.ymd(noonish)).toBe('20260105')
  })
  it('minsUntil never goes negative and rounds up', () => {
    expect(E.minsUntil(0, 90_000)).toBe(2) // 1.5 min -> 2
    expect(E.minsUntil(100_000, 0)).toBe(0)
  })
  it('countdown formats remaining ms as M:SS', () => {
    expect(E.countdown(90_000)).toBe('1:30')
    expect(E.countdown(-5)).toBe('0:00')
  })
  it('sameDay compares SGT calendar days', () => {
    expect(E.sameDay(noonish, noonish + 3600e3)).toBe(true)
    expect(E.sameDay(noonish, noonish + 864e5)).toBe(false)
  })
  it('since reads "just now", "N min ago", then a clock/date', () => {
    expect(E.since(noonish, noonish + 30_000)).toBe('just now')
    expect(E.since(noonish, noonish + 5 * 60_000)).toBe('5 min ago')
    // Over an hour, same day -> the clock time of the original moment.
    expect(E.since(noonish, noonish + 2 * 3600e3)).toBe('12:35 pm')
  })
})

// ---- distance -------------------------------------------------------------
describe('distance', () => {
  const a = { lat: 1.296, lng: 103.85 }
  it('is zero for identical points and grows with separation', () => {
    expect(E.distanceM(a, a)).toBe(0)
    const near = { lat: 1.297, lng: 103.851 }
    const far = { lat: 1.31, lng: 103.86 }
    expect(E.distanceM(a, far)).toBeGreaterThan(E.distanceM(a, near))
  })
  it('walkEstimate applies a detour factor and a 1-minute floor', () => {
    const est = E.walkEstimate(a, a)
    expect(est.meters).toBe(0)
    expect(est.minutes).toBe(1) // floored to 1 even for 0 metres
    expect(est.source).toBe('estimate')
    expect(est.coords).toEqual([[a.lat, a.lng], [a.lat, a.lng]])
  })
})

// ---- opening hours --------------------------------------------------------
describe('openStatus / hoursToday', () => {
  // Monday noon SGT.
  const mondayNoon = Date.UTC(2026, 0, 5, 4, 0, 0)
  const store = (hours, is_open = true) => ({ is_open, open_hours: hours })

  it('a paused store is always closed', () => {
    expect(E.openStatus(store({}, false), mondayNoon, true)).toEqual({ open: false, label: 'Paused by the store' })
  })

  it('open when now is inside a range', () => {
    const s = store({ mon: ['08:00', '20:00'] })
    expect(E.openStatus(s, mondayNoon, true)).toEqual({ open: true, label: 'Open until 8:00 pm' })
  })

  it('when hours are not enforced, a store outside its hours still takes orders', () => {
    const s = store({ mon: ['08:00', '10:00'] }) // closed by noon
    const res = E.openStatus(s, mondayNoon, false)
    expect(res.open).toBe(true)
    expect(res.label).toContain('Taking orders')
  })

  it('when enforced and before the next range, reports when it opens', () => {
    const s = store({ mon: ['14:00', '20:00'] }) // opens at 2pm
    expect(E.openStatus(s, mondayNoon, true)).toEqual({ open: false, label: 'Closed, opens 2:00 pm' })
  })

  it('when enforced and past the last range, reports closed for the day', () => {
    const s = store({ mon: ['08:00', '10:00'] })
    expect(E.openStatus(s, mondayNoon, true)).toEqual({ open: false, label: 'Closed for today' })
  })

  it('supports multiple ranges in a day', () => {
    const s = store({ mon: [['08:00', '11:00'], ['13:00', '18:00']] })
    // noon falls in the gap -> enforced closed, opens 1pm
    expect(E.openStatus(s, mondayNoon, true)).toEqual({ open: false, label: 'Closed, opens 1:00 pm' })
  })

  it('hoursToday renders the ranges or "Closed today"', () => {
    expect(E.hoursToday(store({ mon: ['08:00', '20:00'] }), mondayNoon)).toBe('8:00 am–8:00 pm')
    expect(E.hoursToday(store({}), mondayNoon)).toBe('Closed today')
  })
})
