import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackPageVisit, resetPageVisitTracking, getVisitorId } from '../pageVisitService'
import { setAccessToken } from '../accessToken'

const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve({ ok: true } as Response))

const lastInit = () => fetchMock.mock.calls.at(-1)![1] as RequestInit
const lastBody = () => JSON.parse(lastInit().body as string)

describe('pageVisitService', () => {
  beforeEach(() => {
    setAccessToken(null)
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockClear()
    localStorage.clear()
    resetPageVisitTracking()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('posts the path with a visitor id', () => {
    trackPageVisit('/library')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = lastBody()
    expect(body.path).toBe('/library')
    expect(body.visitorId).toBeTruthy()
  })

  it('sends the beacon to the ingest endpoint with keepalive so a closing page still counts', () => {
    trackPageVisit('/library')

    expect(fetchMock.mock.calls.at(-1)![0]).toBe('/api/analytics/page-visits')
    expect(lastInit().keepalive).toBe(true)
    expect(lastInit().method).toBe('POST')
  })

  it('does not post the same path twice in a row', () => {
    trackPageVisit('/library')
    trackPageVisit('/library')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('posts again when the visitor moves to another page', () => {
    trackPageVisit('/library')
    trackPageVisit('/flashcards')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(lastBody().path).toBe('/flashcards')
  })

  it('sends the referrer only on the first beacon of the page load', () => {
    Object.defineProperty(document, 'referrer', { value: 'https://news.ycombinator.com/', configurable: true })

    trackPageVisit('/')
    expect(lastBody().referrer).toBe('https://news.ycombinator.com/')

    trackPageVisit('/login')
    expect(lastBody().referrer).toBeNull()
  })

  it('attaches the bearer token when the visitor is signed in', () => {
    setAccessToken('jwt-123')

    trackPageVisit('/dashboard')

    expect((lastInit().headers as Record<string, string>).Authorization).toBe('Bearer jwt-123')
  })

  it('omits the authorization header for anonymous visitors', () => {
    trackPageVisit('/')

    expect((lastInit().headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('keeps the visitor id across visits', () => {
    const visitor = getVisitorId()

    trackPageVisit('/library')

    expect(getVisitorId()).toBe(visitor)
    expect(localStorage.getItem('sp_visitor_id')).toBe(visitor)
  })

  it('never throws when the network rejects', () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')))

    expect(() => trackPageVisit('/library')).not.toThrow()
  })
})
