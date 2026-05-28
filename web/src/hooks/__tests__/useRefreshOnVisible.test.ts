import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRefreshOnVisible } from '../useRefreshOnVisible'

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, writable: true, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useRefreshOnVisible', () => {
  beforeEach(() => {
    setVisibility('visible')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call refresh on initial render', () => {
    const refresh = vi.fn()
    renderHook(() => useRefreshOnVisible(refresh))

    expect(refresh).not.toHaveBeenCalled()
  })

  it('calls refresh when tab becomes visible after being hidden', () => {
    const refresh = vi.fn()
    renderHook(() => useRefreshOnVisible(refresh))

    setVisibility('hidden')
    setVisibility('visible')

    expect(refresh).toHaveBeenCalledOnce()
  })

  it('does not call refresh when tab was not hidden first', () => {
    const refresh = vi.fn()
    // Start visible, fire visibilitychange while still visible
    renderHook(() => useRefreshOnVisible(refresh))
    setVisibility('visible')

    expect(refresh).not.toHaveBeenCalled()
  })

  it('respects minIntervalMs and skips refresh if called too soon', () => {
    const refresh = vi.fn()
    const minIntervalMs = 5000
    renderHook(() => useRefreshOnVisible(refresh, minIntervalMs))

    setVisibility('hidden')
    setVisibility('visible')
    expect(refresh).toHaveBeenCalledOnce()

    // Simulate tab hide/show again before the interval elapses
    setVisibility('hidden')
    vi.advanceTimersByTime(minIntervalMs - 1)
    setVisibility('visible')

    expect(refresh).toHaveBeenCalledOnce()
  })

  it('allows refresh again after minIntervalMs has elapsed', () => {
    const refresh = vi.fn()
    const minIntervalMs = 5000
    renderHook(() => useRefreshOnVisible(refresh, minIntervalMs))

    setVisibility('hidden')
    setVisibility('visible')
    expect(refresh).toHaveBeenCalledOnce()

    setVisibility('hidden')
    vi.advanceTimersByTime(minIntervalMs + 1)
    setVisibility('visible')

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('removes the visibilitychange listener on unmount', () => {
    const refresh = vi.fn()
    const { unmount } = renderHook(() => useRefreshOnVisible(refresh))
    unmount()

    setVisibility('hidden')
    setVisibility('visible')

    expect(refresh).not.toHaveBeenCalled()
  })
})
