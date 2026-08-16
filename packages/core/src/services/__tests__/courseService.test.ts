import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createCourseService } from '../courseService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

const backendCourse = (id = 'c-1') => ({
  courseId: id,
  courseName: 'Algorithms',
  courseColor: '#3B82F6',
})

describe('courseService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createCourseService(fakeHttp)

  it('getCourses maps the backend list to the UI shape', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: [backendCourse('c-1'), backendCourse('c-2')] } })

    const courses = await service.getCourses()

    expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses')
    expect(courses).toEqual([
      { id: 'c-1', name: 'Algorithms', color: '#3B82F6' },
      { id: 'c-2', name: 'Algorithms', color: '#3B82F6' },
    ])
  })

  it('getCourse maps a single course', async () => {
    vi.mocked(fakeHttp.get).mockResolvedValueOnce({ data: { data: backendCourse('c-42') } })
    const course = await service.getCourse('c-42')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/courses/c-42')
    expect(course).toEqual({ id: 'c-42', name: 'Algorithms', color: '#3B82F6' })
  })

  it('createCourse posts and maps the created course', async () => {
    vi.mocked(fakeHttp.post).mockResolvedValueOnce({ data: { data: backendCourse('new-c') } })
    const course = await service.createCourse({ courseName: 'Algorithms', courseColor: '#3B82F6' })
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/courses', { courseName: 'Algorithms', courseColor: '#3B82F6' })
    expect(course.id).toBe('new-c')
  })

  it('updateCourse puts and maps the updated course', async () => {
    const updated = { ...backendCourse('c-1'), courseName: 'Data Structures', courseColor: '#EF4444' }
    vi.mocked(fakeHttp.put).mockResolvedValueOnce({ data: { data: updated } })
    const course = await service.updateCourse('c-1', { courseName: 'Data Structures', courseColor: '#EF4444' })
    expect(fakeHttp.put).toHaveBeenCalledWith('/api/courses/c-1', { courseName: 'Data Structures', courseColor: '#EF4444' })
    expect(course.name).toBe('Data Structures')
  })

  it('deleteCourse calls DELETE with the id', async () => {
    vi.mocked(fakeHttp.delete).mockResolvedValueOnce({ data: undefined })
    await service.deleteCourse('c-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/courses/c-1')
  })
})
