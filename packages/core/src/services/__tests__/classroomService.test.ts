import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClassroomService } from '../classroomService'
import type { HttpClient } from '../../http'

const fakeHttp: HttpClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}

describe('classroomService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createClassroomService(fakeHttp)

  describe('organizations', () => {
    it('getMyOrganizations GETs /api/organizations', () => {
      service.getMyOrganizations()
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/organizations')
    })

    it('getOrganization GETs the org-scoped endpoint', () => {
      service.getOrganization('org-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/organizations/org-1')
    })

    it('createOrganization posts the name', () => {
      service.createOrganization('Acme U')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/organizations', { name: 'Acme U' })
    })

    it('inviteMember posts email/role', () => {
      service.inviteMember('org-1', 'a@b.com', 'instructor')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/organizations/org-1/members', { email: 'a@b.com', role: 'instructor' })
    })

    it('removeOrganizationMember deletes the member-scoped endpoint', () => {
      service.removeOrganizationMember('org-1', 'u-1')
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/organizations/org-1/members/u-1')
    })
  })

  describe('classrooms', () => {
    it('getMyClassrooms GETs /api/classrooms', () => {
      service.getMyClassrooms()
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/classrooms')
    })

    it('createClassroom posts the payload', () => {
      const data = { organizationId: 'org-1', name: 'CS 101' }
      service.createClassroom(data)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/classrooms', data)
    })

    it('joinClassroom posts the join code', () => {
      service.joinClassroom('CODE1')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/classrooms/join', { joinCode: 'CODE1' })
    })

    it('archiveClassroom puts the archived flag', () => {
      service.archiveClassroom('c-1', true)
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/classrooms/c-1/archive', { archived: true })
    })

    it('rotateJoinCode posts to the rotate endpoint', () => {
      service.rotateJoinCode('c-1')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/classrooms/c-1/join-code/rotate', {})
    })

    it('setEnrollmentOpen puts the open flag', () => {
      service.setEnrollmentOpen('c-1', false)
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/classrooms/c-1/enrollment', { open: false })
    })
  })

  describe('roster', () => {
    it('addMember posts email/role to the roster endpoint', () => {
      service.addMember('c-1', 'a@b.com', 'student')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/classrooms/c-1/roster', { email: 'a@b.com', role: 'student' })
    })

    it('setRole puts the new role for a user', () => {
      service.setRole('c-1', 'u-1', 'assistant')
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/classrooms/c-1/roster/u-1/role', { role: 'assistant' })
    })

    it('removeEnrollment deletes the roster-scoped endpoint', () => {
      service.removeEnrollment('c-1', 'u-1')
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/classrooms/c-1/roster/u-1')
    })
  })

  describe('course assignment', () => {
    it('assignCourse posts courseId/dueAt', () => {
      service.assignCourse('c-1', 'course-1', '2026-12-01')
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/classrooms/c-1/courses', { courseId: 'course-1', dueAt: '2026-12-01' })
    })

    it('unassignCourse deletes the classroom-course-scoped endpoint', () => {
      service.unassignCourse('c-1', 'cc-1')
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/classrooms/c-1/courses/cc-1')
    })
  })

  describe('assignments', () => {
    const saveInput = { title: 'Essay 1', pointsPossible: 100, allowLateSubmissions: false, publish: true }

    it('getAssignments GETs the classroom-scoped list', () => {
      service.getAssignments('c-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/classrooms/c-1/assignments')
    })

    it('getAssignment GETs the assignment-scoped detail', () => {
      service.getAssignment('c-1', 'a-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/classrooms/c-1/assignments/a-1')
    })

    it('createAssignment posts the payload', () => {
      service.createAssignment('c-1', saveInput)
      expect(fakeHttp.post).toHaveBeenCalledWith('/api/classrooms/c-1/assignments', saveInput)
    })

    it('updateAssignment puts the payload to the assignment-scoped endpoint', () => {
      service.updateAssignment('c-1', 'a-1', saveInput)
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/classrooms/c-1/assignments/a-1', saveInput)
    })

    it('deleteAssignment deletes by id', () => {
      service.deleteAssignment('c-1', 'a-1')
      expect(fakeHttp.delete).toHaveBeenCalledWith('/api/classrooms/c-1/assignments/a-1')
    })
  })

  describe('submissions', () => {
    it('saveSubmission puts text/submit to the submission endpoint', () => {
      service.saveSubmission('c-1', 'a-1', 'my essay text', false)
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/classrooms/c-1/assignments/a-1/submission', { text: 'my essay text', submit: false })
    })

    it('gradeSubmission puts pointsAwarded/feedback to the student-scoped grade endpoint', () => {
      service.gradeSubmission('c-1', 'a-1', 'u-1', 95, 'Nice work')
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/classrooms/c-1/assignments/a-1/submissions/u-1/grade', {
        pointsAwarded: 95,
        feedback: 'Nice work',
      })
    })

    it('gradeSubmission accepts a null score to clear the grade', () => {
      service.gradeSubmission('c-1', 'a-1', 'u-1', null)
      expect(fakeHttp.put).toHaveBeenCalledWith('/api/classrooms/c-1/assignments/a-1/submissions/u-1/grade', {
        pointsAwarded: null,
        feedback: undefined,
      })
    })
  })

  describe('gradebook', () => {
    it('getGradebook GETs the classroom-scoped gradebook', () => {
      service.getGradebook('c-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/classrooms/c-1/gradebook')
    })

    it('getStudentProgress GETs the student-scoped progress', () => {
      service.getStudentProgress('c-1', 'u-1')
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/classrooms/c-1/students/u-1/progress')
    })

    it('gradebookCsvPath builds the CSV download path without making a request', () => {
      expect(service.gradebookCsvPath('c-1')).toBe('/api/classrooms/c-1/gradebook.csv')
      expect(fakeHttp.get).not.toHaveBeenCalled()
    })
  })

  describe('deadlines', () => {
    it('defaults days to 14', () => {
      service.getDeadlines()
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/classrooms/deadlines?days=14')
    })

    it('passes an explicit days value', () => {
      service.getDeadlines(30)
      expect(fakeHttp.get).toHaveBeenCalledWith('/api/classrooms/deadlines?days=30')
    })
  })
})
