// Component test for components/StatusTag.vue — the pill badge. Verifies the tone
// maps to the matching Bootstrap subtle/emphasis classes, the slot renders, and
// the optional leading dot shows only when requested.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusTag from '../StatusTag.vue'

const mountTag = (props = {}, slot = 'Open') =>
  mount(StatusTag, { props, slots: { default: slot } })

describe('StatusTag', () => {
  it('renders the slot content', () => {
    expect(mountTag({}, 'Ready').text()).toContain('Ready')
  })

  it('maps known tones to subtle/emphasis classes', () => {
    expect(mountTag({ tone: 'ok' }).classes()).toEqual(
      expect.arrayContaining(['bg-success-subtle', 'text-success-emphasis']),
    )
    expect(mountTag({ tone: 'warn' }).classes()).toEqual(
      expect.arrayContaining(['bg-warning-subtle', 'text-warning-emphasis']),
    )
    expect(mountTag({ tone: 'muted' }).classes()).toEqual(
      expect.arrayContaining(['bg-secondary-subtle', 'text-secondary-emphasis']),
    )
  })

  it('falls back to a neutral style for an unknown tone', () => {
    expect(mountTag({ tone: 'nope' }).classes()).toEqual(
      expect.arrayContaining(['bg-body-tertiary', 'text-body']),
    )
  })

  it('shows a dot only when dot is set', () => {
    expect(mountTag({ dot: false }).find('.dot').exists()).toBe(false)
    expect(mountTag({ dot: true }).find('.dot').exists()).toBe(true)
  })
})
