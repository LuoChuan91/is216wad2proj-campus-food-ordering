// Store unit tests for stores/admin.js — the admin actions split out of orders.js:
// student account status (approve/block/remove) and addVenue validation. The api
// is mocked; we assert the server call, the catalog update, and the ui.run()
// busy-guard / error-toast behaviour (via the draft form error for addVenue).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/api.js', () => ({
  api: {
    profiles: vi.fn().mockResolvedValue([]),
    profile: vi.fn().mockResolvedValue({}),
    venues: vi.fn().mockResolvedValue([]),
    destinations: vi.fn().mockResolvedValue([]),
    stores: vi.fn().mockResolvedValue([]),
    menu: vi.fn().mockResolvedValue([]),
    setProfileStatus: vi.fn(),
    addVenue: vi.fn(),
  },
  setActor: vi.fn(),
}))

import { api } from '@/services/api.js'
import { useAdminStore } from '../admin.js'
import { useUiStore } from '../ui.js'
import { useCatalogStore } from '../catalog.js'
import { useNotificationsStore } from '../notifications.js'
import { seedCatalog } from './fixtures.js'

describe('admin store: student status', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    seedCatalog()
  })

  it('approveStudent patches the profile and merges the result into the catalog', async () => {
    const admin = useAdminStore()
    const catalog = useCatalogStore()
    api.setProfileStatus.mockResolvedValue({ id: 'stu', status: 'active' })
    catalog.user('stu').status = 'inactive'

    await admin.approveStudent('stu')

    expect(api.setProfileStatus).toHaveBeenCalledWith('stu', 'active')
    expect(catalog.user('stu').status).toBe('active')
  })

  it('blockStudent and removeStudent send the matching status', async () => {
    const admin = useAdminStore()
    api.setProfileStatus.mockResolvedValue({ id: 'stu', status: 'blocked' })
    await admin.blockStudent('stu')
    expect(api.setProfileStatus).toHaveBeenLastCalledWith('stu', 'blocked')
    api.setProfileStatus.mockResolvedValue({ id: 'stu', status: 'removed' })
    await admin.removeStudent('stu')
    expect(api.setProfileStatus).toHaveBeenLastCalledWith('stu', 'removed')
  })

  it('a failed status change surfaces a notification and clears the busy flag', async () => {
    const admin = useAdminStore()
    const ui = useUiStore()
    const notes = useNotificationsStore()
    api.setProfileStatus.mockRejectedValue(new Error('nope'))

    await admin.approveStudent('stu')

    expect(notes.items[0].body).toBe('nope')
    expect(ui.busy.stu).toBeUndefined()
  })
})

describe('admin store: addVenue validation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    seedCatalog()
  })

  function draft(ui, { name = 'New Venue', lat = '1.30', lng = '103.85' } = {}) {
    ui.ui.staff.venueDraft = { name, lat, lng }
  }

  it('rejects an empty name without calling the server', async () => {
    const admin = useAdminStore()
    const ui = useUiStore()
    draft(ui, { name: '  ' })
    await admin.addVenue()
    expect(ui.ui.staff.formError).toMatch(/name/i)
    expect(api.addVenue).not.toHaveBeenCalled()
  })

  it('rejects a pin outside Singapore', async () => {
    const admin = useAdminStore()
    const ui = useUiStore()
    draft(ui, { lat: '48.85', lng: '2.35' }) // Paris
    await admin.addVenue()
    expect(ui.ui.staff.formError).toMatch(/Singapore/i)
    expect(api.addVenue).not.toHaveBeenCalled()
  })

  it('saves a valid venue and pushes it into the catalog, resetting the draft', async () => {
    const admin = useAdminStore()
    const ui = useUiStore()
    const catalog = useCatalogStore()
    draft(ui, { name: 'LKS Steps', lat: '1.2966', lng: '103.85' })
    api.addVenue.mockResolvedValue({ id: 'v2', name: 'LKS Steps', lat: 1.2966, lng: 103.85, type: 'eatery' })

    await admin.addVenue()

    expect(api.addVenue).toHaveBeenCalledWith({ name: 'LKS Steps', lat: 1.2966, lng: 103.85, type: 'eatery' })
    expect(catalog.venue('v2')).toBeTruthy()
    expect(ui.ui.staff.venueDraft).toEqual({ name: '', lat: '', lng: '' })
    expect(ui.ui.staff.saving).toBe(false)
  })

  it('surfaces the server error on the draft form and stops saving', async () => {
    const admin = useAdminStore()
    const ui = useUiStore()
    draft(ui, { name: 'LKS Steps', lat: '1.2966', lng: '103.85' })
    api.addVenue.mockRejectedValue(new Error('duplicate venue'))

    await admin.addVenue()

    expect(ui.ui.staff.formError).toBe('duplicate venue')
    expect(ui.ui.staff.saving).toBe(false)
  })
})
