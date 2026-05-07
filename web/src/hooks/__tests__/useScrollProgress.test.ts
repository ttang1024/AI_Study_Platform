import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollProgress } from '../useScrollProgress'

function makeContainer(scrollTop = 0, clientHeight = 500, scrollHeight = 2000) {
  return {
    scrollTop,
    clientHeight,
    scrollHeight,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement
}

describe('useScrollProgress', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('getSavedProgress returns null when nothing is stored', () => {
    const ref = { current: makeContainer() }
    const { result } = renderHook(() => useScrollProgress('u1', 'doc1', ref))
    expect(result.current.getSavedProgress()).toBeNull()
  })

  it('saves progress to localStorage after the debounce delay', () => {
    const el = makeContainer(300, 500, 1000)
    const ref = { current: el }

    // Capture the scroll handler
    let scrollHandler: (() => void) | undefined
    el.addEventListener = vi.fn((event, handler) => {
      if (event === 'scroll') scrollHandler = handler as () => void
    })

    const { result } = renderHook(() => useScrollProgress('u1', 'doc1', ref))

    act(() => {
      scrollHandler?.()
      vi.advanceTimersByTime(1500)
    })

    const saved = result.current.getSavedProgress()
    expect(saved).not.toBeNull()
    expect(saved?.scrollTop).toBe(300)
    expect(saved?.percentage).toBe(60) // 300 / (1000 - 500) = 60%
  })

  it('clearProgress removes the stored entry', () => {
    const ref = { current: makeContainer() }
    localStorage.setItem('scroll_u1_doc1', JSON.stringify({ scrollTop: 100, percentage: 20 }))
    const { result } = renderHook(() => useScrollProgress('u1', 'doc1', ref))

    act(() => {
      result.current.clearProgress()
    })

    expect(result.current.getSavedProgress()).toBeNull()
  })

  it('restoreProgress sets scrollTop on the container', () => {
    let rafCallback: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb
      return 1
    })

    const el = makeContainer()
    el.addEventListener = vi.fn()
    const ref = { current: el }

    localStorage.setItem(
      'scroll_u1_doc1',
      JSON.stringify({ scrollTop: 450, percentage: 30, timestamp: new Date().toISOString() }),
    )

    const { result } = renderHook(() => useScrollProgress('u1', 'doc1', ref))

    act(() => {
      result.current.restoreProgress()
      rafCallback?.(0)
    })

    expect(el.scrollTop).toBe(450)

    vi.unstubAllGlobals()
  })

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('scroll_u1_doc1', 'NOT_JSON')
    const ref = { current: makeContainer() }
    const { result } = renderHook(() => useScrollProgress('u1', 'doc1', ref))
    expect(result.current.getSavedProgress()).toBeNull()
  })
})
