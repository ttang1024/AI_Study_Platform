import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackPageVisit, resetPageVisitTracking, getVisitorId, getSessionId } from '../pageVisitService'

const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve({ ok: true } as Response))

const lastInit = () => fetchMock.mock.calls.at(-1)![1] as RequestInit
const lastBody = () => JSON.parse(lastInit().body as string)

describe('pageVisitService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockClear()
    localStorage.clear()
    sessionStorage.clear()
    resetPageVisitTracking()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('posts the path with a visitor and session id', () => {
    trackPageVisit('/library')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = lastBody()
    expect(body.path).toBe('/library')
    expect(body.visitorId).toBeTruthy()
    expect(body.sessionId).toBeTruthy()
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
    localStorage.setItem('sp_access_token', 'jwt-123')

    trackPageVisit('/dashboard')

    expect((lastInit().headers as Record<string, string>).Authorization).toBe('Bearer jwt-123')
  })

  it('omits the authorization header for anonymous visitors', () => {
    trackPageVisit('/')

    expect((lastInit().headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('keeps the visitor id across visits and the session id within the tab', () => {
    const visitor = getVisitorId()
    const session = getSessionId()

    trackPageVisit('/library')

    expect(getVisitorId()).toBe(visitor)
    expect(getSessionId()).toBe(session)
    expect(localStorage.getItem('sp_visitor_id')).toBe(visitor)
    expect(sessionStorage.getItem('sp_session_id')).toBe(session)
  })

  it('never throws when the network rejects', () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')))

    expect(() => trackPageVisit('/library')).not.toThrow()
  })
})
