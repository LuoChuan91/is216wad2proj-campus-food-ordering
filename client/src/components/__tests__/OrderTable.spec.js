// Component test for components/OrderTable.vue — the staff/student order table.
// Verifies a row renders the code, item lines (capped at two + "more"), the
// resolved status label and total, emits open on row click, and shows the
// customer "Collected" action only for an uncompleted pickup in the active table.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({
  api: { setOrderStatus: vi.fn().mockResolvedValue({ id: 'o1', status: 'completed' }) },
  setActor: vi.fn(),
}))

import OrderTable from '../OrderTable.vue'
import { api } from '@/services/api.js'

const s = { id: 's1', name: 'Bento Bar', mono: 'BB', color: '#123' }
const order = (over = {}) => ({
  id: 'o1', code: 'E287', type: 'pickup', status: 'ready', total: 19.21, created_at: 0,
  items: [
    { id: 'l1', qty: 2, name: 'Teriyaki', option_names: ['White Rice'] },
    { id: 'l2', qty: 1, name: 'Green Tea', option_names: [] },
    { id: 'l3', qty: 1, name: 'Miso', option_names: [] },
  ],
  ...over,
})

function mountTable(rows, props = {}) {
  return mount(OrderTable, {
    props: { rows, ...props },
    global: { stubs: { Mono: true, Icon: true } },
  })
}

describe('OrderTable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders the order code, total and resolved status label', () => {
    const w = mountTable([{ o: order(), s }])
    expect(w.text()).toContain('#E287')
    expect(w.text()).toContain('$19.21')
    expect(w.text()).toContain('Ready') // orderStatusLabel(ready pickup)
  })

  it('shows the first two item lines and a "+N more" note', () => {
    const w = mountTable([{ o: order(), s }])
    expect(w.text()).toContain('2x Teriyaki')
    expect(w.text()).toContain('White Rice')
    expect(w.text()).toContain('+1 more') // 3 items, 2 shown
  })

  it('emits open with the order id when a row is clicked', async () => {
    const w = mountTable([{ o: order(), s }])
    await w.find('tbody tr').trigger('click')
    expect(w.emitted('open')).toEqual([['o1']])
  })

  it('active pickup row shows a Collected action that marks the order collected', async () => {
    const w = mountTable([{ o: order({ status: 'ready' }), s }], { active: true })
    const btn = w.findAll('button').find((b) => b.text() === 'Collected')
    expect(btn).toBeTruthy()
    await btn.trigger('click')
    expect(api.setOrderStatus).toHaveBeenCalledWith('o1', 'completed')
  })

  it('does not show the Collected action in a non-active (past) table', () => {
    const w = mountTable([{ o: order({ status: 'completed' }), s }], { active: false })
    const btn = w.findAll('button').find((b) => b.text() === 'Collected')
    expect(btn).toBeUndefined()
  })
})
