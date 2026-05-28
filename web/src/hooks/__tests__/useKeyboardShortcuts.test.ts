import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts, type Shortcut } from '../useKeyboardShortcuts'

const fireKey = (key: string, opts: Partial<KeyboardEventInit> = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts })
  window.dispatchEvent(event)
  return event
}

describe('useKeyboardShortcuts', () => {
  it('calls the matching shortcut action', () => {
    const action = vi.fn()
    const shortcuts: Shortcut[] = [{ key: 'f', description: 'Find', action }]
    renderHook(() => useKeyboardShortcuts(shortcuts))

    fireKey('f')

    expect(action).toHaveBeenCalledOnce()
  })

  it('is case-insensitive for key matching', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'F', description: 'Find', action }]))

    fireKey('f')

    expect(action).toHaveBeenCalledOnce()
  })

  it('does not fire when a modifier is required but not pressed', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 's', meta: true, description: 'Save', action }]))

    fireKey('s')

    expect(action).not.toHaveBeenCalled()
  })

  it('fires when meta modifier is held', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 's', meta: true, description: 'Save', action }]))

    fireKey('s', { metaKey: true })

    expect(action).toHaveBeenCalledOnce()
  })

  it('fires when ctrl is treated as meta substitute', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 's', meta: true, description: 'Save', action }]))

    fireKey('s', { ctrlKey: true })

    expect(action).toHaveBeenCalledOnce()
  })

  it('does not fire when typing in an input element', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 'f', description: 'Find', action }]))

    const input = document.createElement('input')
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'f', bubbles: true })
    Object.defineProperty(event, 'target', { value: input })
    window.dispatchEvent(event)
    document.body.removeChild(input)

    expect(action).not.toHaveBeenCalled()
  })

  it('does not fire when modifier keys are pressed without a matching shortcut requiring them', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: 's', description: 'Save', action }]))

    fireKey('s', { metaKey: true })

    expect(action).not.toHaveBeenCalled()
  })

  it('fires shift-modified shortcut only when shift is pressed', () => {
    const action = vi.fn()
    renderHook(() => useKeyboardShortcuts([{ key: '?', shift: true, description: 'Help', action }]))

    fireKey('?', { shiftKey: true })
    expect(action).toHaveBeenCalledOnce()

    action.mockClear()
    fireKey('?')
    expect(action).not.toHaveBeenCalled()
  })

  it('removes listener on unmount', () => {
    const action = vi.fn()
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: 'x', description: 'X', action }])
    )
    unmount()

    fireKey('x')

    expect(action).not.toHaveBeenCalled()
  })
})
