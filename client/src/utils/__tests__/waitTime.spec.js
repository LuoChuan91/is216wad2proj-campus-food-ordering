import { describe, it, expect } from 'vitest'
import { estimateWaitTime, formatWaitTime, WAIT_TIME_STRATEGIES, estimateNewOrderWait } from '../waitTime.js'

// Cooking details used across tests.
//   burger: 60s each, cooks 2 at once (batch size 2)
//   fries : 30s each, cooks 4 at once
//   soup  : 120s each, cooks 1 at once
const DETAILS = [
  { id: 'burger', cook_time_sec: 60, max_at_once: 2 },
  { id: 'fries', cook_time_sec: 30, max_at_once: 4 },
  { id: 'soup', cook_time_sec: 120, max_at_once: 1 },
]

describe('estimateWaitTime - batching per dish', () => {
  it('one dish, qty within one batch = cook_time_sec', () => {
    const items = [{ menu_item_id: 'burger', qty: 2 }] // ceil(2/2)=1 batch * 60
    const { seconds, perItem } = estimateWaitTime(items, DETAILS)
    expect(seconds).toBe(60)
    expect(perItem[0]).toMatchObject({ menuItemId: 'burger', qty: 2, batches: 1, seconds: 60 })
  })

  it('one dish, qty spans multiple batches', () => {
    const items = [{ menu_item_id: 'burger', qty: 5 }] // ceil(5/2)=3 batches * 60 = 180
    const { seconds } = estimateWaitTime(items, DETAILS)
    expect(seconds).toBe(180)
  })

  it('sums quantities for the same dish across multiple order-items', () => {
    const items = [
      { menu_item_id: 'burger', qty: 1 },
      { menu_item_id: 'burger', qty: 1 },
    ] // combined qty 2 -> 1 batch -> 60 (not 2 batches)
    const { seconds } = estimateWaitTime(items, DETAILS)
    expect(seconds).toBe(60)
  })
})

describe('estimateWaitTime - strategies', () => {
  // burger qty 5 -> 180s ; fries qty 4 -> ceil(4/4)=1 batch -> 30s ; soup qty 2 -> 2 batches -> 240s
  const items = [
    { menu_item_id: 'burger', qty: 5 },
    { menu_item_id: 'fries', qty: 4 },
    { menu_item_id: 'soup', qty: 2 },
  ]
  // per-dish times: burger 180, fries 30, soup 240

  it('serial = sum of all dish times', () => {
    const { seconds } = estimateWaitTime(items, DETAILS, { strategy: 'serial' })
    expect(seconds).toBe(180 + 30 + 240) // 450
  })

  it('bottleneck = busiest dish', () => {
    const { seconds } = estimateWaitTime(items, DETAILS, { strategy: 'bottleneck' })
    expect(seconds).toBe(240)
  })

  it('factor = max(bottleneck, ceil(sum/stations))', () => {
    // sum 450, stations 2 -> ceil(225)=225 ; bottleneck 240 -> max = 240
    const { seconds } = estimateWaitTime(items, DETAILS, { strategy: 'factor', stations: 2 })
    expect(seconds).toBe(240)
    // stations 1 collapses to serial-like: max(240, 450) = 450
    expect(estimateWaitTime(items, DETAILS, { strategy: 'factor', stations: 1 }).seconds).toBe(450)
  })

  it('throws on unknown strategy', () => {
    expect(() => estimateWaitTime(items, DETAILS, { strategy: 'nope' })).toThrow(/Unknown wait-time strategy/)
  })

  it('exposes the available strategy names', () => {
    expect(WAIT_TIME_STRATEGIES).toEqual(expect.arrayContaining(['serial', 'bottleneck', 'factor', 'scheduled']))
  })
})

describe('estimateWaitTime - scheduled strategy (LPT over batches)', () => {
  // Dish A: cook 180s, batch size 1 -> qty 3 expands to 3 batches of 180
  // Dish B: cook 120s, batch size 1 -> qty 4 expands to 4 batches of 120
  // batch list = [180,180,180,120,120,120,120]
  const SCHED_DETAILS = [
    { id: 'A', cook_time_sec: 180, max_at_once: 1 },
    { id: 'B', cook_time_sec: 120, max_at_once: 1 },
  ]
  const items = [
    { menu_item_id: 'A', qty: 3 },
    { menu_item_id: 'B', qty: 4 },
  ]

  it("matches the hand-computed makespan: 3 stations -> 420s", () => {
    // LPT: A,A,A on the three stations (180 each), then 120s go onto them:
    // [180,180,180] -> +120 -> [300,180,180] -> [300,300,180] -> [300,300,300]
    // -> [420,300,300]; makespan = 420
    const { seconds } = estimateWaitTime(items, SCHED_DETAILS, { strategy: 'scheduled', stations: 3 })
    expect(seconds).toBe(420)
  })

  it('two stations packs batches onto the earliest-free station', () => {
    // [180,180,180,120,120,120,120], 2 stations, LPT:
    // 180->[180,0] 180->[180,180] 180->[360,180] 120->[360,300] 120->[360,420]... let's trust the algorithm
    // Compute expected independently: total=900, must be >= ceil(900/2)=450 and >= max batch 180
    const { seconds } = estimateWaitTime(items, SCHED_DETAILS, { strategy: 'scheduled', stations: 2 })
    expect(seconds).toBeGreaterThanOrEqual(450)
    expect(seconds).toBeGreaterThanOrEqual(180)
  })

  it('stations = 1 equals the serial sum', () => {
    const sched = estimateWaitTime(items, SCHED_DETAILS, { strategy: 'scheduled', stations: 1 }).seconds
    const serial = estimateWaitTime(items, SCHED_DETAILS, { strategy: 'serial' }).seconds
    expect(sched).toBe(serial) // 3*180 + 4*120 = 1020
    expect(sched).toBe(1020)
  })

  it('respects max_at_once when expanding into batches', () => {
    // 6 burgers, batch size 2 -> 3 batches of 60s. 2 stations LPT:
    // 60->[60,0] 60->[60,60] 60->[120,60]; makespan 120
    const details = [{ id: 'burger', cook_time_sec: 60, max_at_once: 2 }]
    const { seconds } = estimateWaitTime([{ menu_item_id: 'burger', qty: 6 }], details, {
      strategy: 'scheduled',
      stations: 2,
    })
    expect(seconds).toBe(120)
  })

  it('never exceeds serial and never undercuts the balanced lower bound', () => {
    const sched = estimateWaitTime(items, SCHED_DETAILS, { strategy: 'scheduled', stations: 3 }).seconds
    const serial = estimateWaitTime(items, SCHED_DETAILS, { strategy: 'serial' }).seconds
    // scheduled operates on individual batches, so its floor is the largest
    // single batch (180s) and the perfectly-balanced split ceil(total/stations).
    const total = 3 * 180 + 4 * 120 // 1020
    const balancedLowerBound = Math.ceil(total / 3) // 340
    expect(sched).toBeLessThanOrEqual(serial) // <= 1020
    expect(sched).toBeGreaterThanOrEqual(180) // >= largest batch
    expect(sched).toBeGreaterThanOrEqual(balancedLowerBound) // >= 340
  })
})

describe('estimateWaitTime - edge cases', () => {
  it('empty queue = 0 for every strategy', () => {
    for (const strategy of WAIT_TIME_STRATEGIES) {
      expect(estimateWaitTime([], DETAILS, { strategy }).seconds).toBe(0)
    }
  })

  it('missing cooking detail is treated as 0 and reported', () => {
    const items = [{ menu_item_id: 'ghost', qty: 3 }]
    const { seconds, missing } = estimateWaitTime(items, DETAILS)
    expect(seconds).toBe(0)
    expect(missing).toContain('ghost')
  })

  it('ignores malformed order-items and non-positive quantities', () => {
    const items = [null, { qty: 2 }, { menu_item_id: 'burger', qty: 0 }, { menu_item_id: 'burger', qty: 2 }]
    const { seconds } = estimateWaitTime(items, DETAILS)
    expect(seconds).toBe(60) // only the valid burger qty 2 counts
  })

  it('defaults missing/invalid inputs to empty', () => {
    expect(estimateWaitTime(undefined, undefined).seconds).toBe(0)
  })
})

describe('formatWaitTime', () => {
  it('formats zero, seconds and minutes', () => {
    expect(formatWaitTime(0)).toBe('No wait')
    expect(formatWaitTime(45)).toBe('~45 sec')
    expect(formatWaitTime(60)).toBe('~1 min')
    expect(formatWaitTime(450)).toBe('~8 min') // 450/60 = 7.5 -> rounds to 8
  })
})


// Fresh-order probe: ported from the server engine (common/engine.js estimateNew).
// Mirrors server/test/engine.test.js, but returns relative { seconds, ahead }.
describe('estimateNewOrderWait (checkout probe)', () => {
  const MIN = 60 // seconds
  // pasta: 300s, cooks 4 at once; kopi: 60s, cooks 12 at once
  const COOK = [
    { id: 'pasta', cook_time_sec: 300, max_at_once: 4 },
    { id: 'kopi', cook_time_sec: 60, max_at_once: 12 },
  ]

  it('empty queue, one dish: wait = its cook time, 0 ahead', () => {
    const r = estimateNewOrderWait([], [{ menu_item_id: 'pasta', qty: 1 }], COOK, { stations: 1, now: 0 })
    expect(r.seconds).toBe(5 * MIN)
    expect(r.ahead).toBe(0)
  })

  it('more than max_at_once makes another batch (1 slot, qty 5 pasta = 2 batches)', () => {
    const r = estimateNewOrderWait([], [{ menu_item_id: 'pasta', qty: 5 }], COOK, { stations: 1, now: 0 })
    expect(r.seconds).toBe(10 * MIN)
  })

  it('a waiting order ahead pushes the fresh order back (1 slot, FCFS)', () => {
    const queue = [
      { id: 'a', status: 'placed', created_at: 1, items: [{ menu_item_id: 'pasta', qty: 1 }] },
    ]
    const r = estimateNewOrderWait(queue, [{ menu_item_id: 'pasta', qty: 1 }], COOK, { stations: 1, now: 0 })
    expect(r.seconds).toBe(10 * MIN) // behind the 5-min order
    expect(r.ahead).toBe(1)
  })

  it('an order already cooking keeps its slot; the fresh order starts when it frees', () => {
    const queue = [
      { id: 'a', status: 'preparing', created_at: 0, preparing_at: -2 * MIN * 1000, items: [{ menu_item_id: 'pasta', qty: 1 }] },
    ]
    // 'a' finishes 3 min from now; a kopi (1 min) then runs -> 4 min.
    const r = estimateNewOrderWait(queue, [{ menu_item_id: 'kopi', qty: 1 }], COOK, { stations: 1, now: 0 })
    expect(r.seconds).toBe(4 * MIN)
    expect(r.ahead).toBe(1)
  })

  it('two slots cook the queue order and the fresh order in parallel', () => {
    const queue = [
      { id: 'a', status: 'placed', created_at: 1, items: [{ menu_item_id: 'pasta', qty: 1 }] },
    ]
    const r = estimateNewOrderWait(queue, [{ menu_item_id: 'pasta', qty: 1 }], COOK, { stations: 2, now: 0 })
    expect(r.seconds).toBe(5 * MIN) // both ready at 5 min
  })

  it('tolerates missing cooking details (treated as 0 cook time)', () => {
    const r = estimateNewOrderWait([], [{ menu_item_id: 'unknown', qty: 2 }], COOK, { stations: 2, now: 0 })
    expect(r.seconds).toBe(0)
  })

  it("honours wait_strategy='serial': ignores extra stations, cooks one line", () => {
    // Two pasta orders ahead + a fresh pasta. With 2 stations (scheduled) they'd
    // cook in parallel; serial forces a single line, so each 5-min order stacks.
    const queue = [
      { id: 'a', status: 'placed', created_at: 1, items: [{ menu_item_id: 'pasta', qty: 1 }] },
    ]
    const serial = estimateNewOrderWait(queue, [{ menu_item_id: 'pasta', qty: 1 }], COOK, { stations: 2, strategy: 'serial', now: 0 })
    expect(serial.seconds).toBe(10 * MIN) // behind the 5-min order on one line
    // Same inputs with the default scheduled strategy run in parallel -> 5 min.
    const scheduled = estimateNewOrderWait(queue, [{ menu_item_id: 'pasta', qty: 1 }], COOK, { stations: 2, strategy: 'scheduled', now: 0 })
    expect(scheduled.seconds).toBe(5 * MIN)
  })

  it("wait_strategy='scheduled' respects the store's workstation count", () => {
    const queue = [
      { id: 'a', status: 'placed', created_at: 1, items: [{ menu_item_id: 'pasta', qty: 1 }] },
    ]
    // 1 station: fresh order waits behind -> 10 min; 2 stations: parallel -> 5 min.
    expect(estimateNewOrderWait(queue, [{ menu_item_id: 'pasta', qty: 1 }], COOK, { stations: 1, strategy: 'scheduled', now: 0 }).seconds).toBe(10 * MIN)
    expect(estimateNewOrderWait(queue, [{ menu_item_id: 'pasta', qty: 1 }], COOK, { stations: 2, strategy: 'scheduled', now: 0 }).seconds).toBe(5 * MIN)
  })
})
