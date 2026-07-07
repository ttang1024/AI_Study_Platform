import { apiClient } from './apiClient'

export interface Mistake {
  id: string
  quizId?: string
  documentId?: string
  videoId?: string
  sourceType: string
  question: string
  options: string[]
  correctAnswer: string
  userAnswer: string
  explanation: string
  status: 'open' | 'resolved'
  timesMissed: number
  firstMissedAt: string
  lastMissedAt: string
  resolvedAt?: string
}

export interface Mistakes {
  items: Mistake[]
  openCount: number
  resolvedCount: number
}

export interface VariantQuestion {
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

// Variant generation is an expensive AI call; collapse concurrent requests for the
// same mistake (StrictMode's double effect, double clicks) into one HTTP request.
const inflightVariantRequests = new Map<string, Promise<VariantQuestion[]>>()

export const mistakesService = {
  async getMistakes(status?: 'open' | 'resolved'): Promise<Mistakes> {
    const res = await apiClient.get('/api/mistakes', { params: status ? { status } : undefined })
    return res.data.data
  },

  async setStatus(mistakeId: string, status: 'open' | 'resolved'): Promise<Mistake> {
    const res = await apiClient.post(`/api/mistakes/${mistakeId}/status`, { status })
    return res.data.data
  },

  async deleteMistake(mistakeId: string): Promise<void> {
    await apiClient.delete(`/api/mistakes/${mistakeId}`)
  },

  async generateVariants(mistakeId: string): Promise<VariantQuestion[]> {
    const pending = inflightVariantRequests.get(mistakeId)
    if (pending) return pending

    const request = apiClient.post(`/api/mistakes/${mistakeId}/variants`)
      .then(res => res.data.data as VariantQuestion[])
      .finally(() => inflightVariantRequests.delete(mistakeId))

    inflightVariantRequests.set(mistakeId, request)
    return request
  },
}
