import { describe, it, expect, vi, afterEach } from 'vitest'
import { deviceTimeZone, timeZoneHeaders } from '../timeZone'

describe('timeZoneHeaders', () => {
  afterEach(() => vi.restoreAllMocks())

  it('sends the device time zone', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'Pacific/Auckland' }) } as never)
    expect(timeZoneHeaders()).toEqual({ 'X-Time-Zone': 'Pacific/Auckland' })
  })

  it('sends nothing when the runtime cannot say', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl')
    })
    expect(deviceTimeZone()).toBeUndefined()
    expect(timeZoneHeaders()).toEqual({})
  })
})
