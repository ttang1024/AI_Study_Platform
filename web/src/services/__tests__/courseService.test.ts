import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../apiClient', () => ({ apiClient: mockApiClient }))

const { courseService } = await import('../courseService')

const backendCourse = (id = 'c-1') => ({
  courseId: id,
  userId: 'u-1',
  courseName: 'Algorithms',
  courseColor: '#3B82F6',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

describe('courseService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getCourses', () => {
    it('returns mapped courses list', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [backendCourse('c-1'), backendCourse('c-2')] } })

      const courses = await courseService.getCourses()

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/courses')
      expect(courses).toHaveLength(2)
      expect(courses[0]).toEqual({ id: 'c-1', name: 'Algorithms', color: '#3B82F6' })
    })

    it('returns empty array when no courses', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: [] } })
      const courses = await courseService.getCourses()
      expect(courses).toHaveLength(0)
    })
  })

  describe('getCourse', () => {
    it('returns a single mapped course', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: { data: backendCourse('c-42') } })

      const course = await courseService.getCourse('c-42')

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/courses/c-42')
      expect(course).toEqual({ id: 'c-42', name: 'Algorithms', color: '#3B82F6' })
    })
  })

  describe('createCourse', () => {
    it('posts and returns the mapped course', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: { data: backendCourse('new-c') } })

      const course = await courseService.createCourse({ courseName: 'Algorithms', courseColor: '#3B82F6' })

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/courses', {
        courseName: 'Algorithms',
        courseColor: '#3B82F6',
      })
      expect(course.id).toBe('new-c')
    })
  })

  describe('updateCourse', () => {
    it('puts and returns the updated course', async () => {
      const updated = { ...backendCourse('c-1'), courseName: 'Data Structures', courseColor: '#EF4444' }
      mockApiClient.put.mockResolvedValueOnce({ data: { data: updated } })

      const course = await courseService.updateCourse('c-1', { courseName: 'Data Structures', courseColor: '#EF4444' })

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/courses/c-1', {
        courseName: 'Data Structures',
        courseColor: '#EF4444',
      })
      expect(course.name).toBe('Data Structures')
      expect(course.color).toBe('#EF4444')
    })
  })

  describe('deleteCourse', () => {
    it('calls DELETE with the course id', async () => {
      mockApiClient.delete.mockResolvedValueOnce({})

      await courseService.deleteCourse('c-1')

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/courses/c-1')
    })
  })
})
