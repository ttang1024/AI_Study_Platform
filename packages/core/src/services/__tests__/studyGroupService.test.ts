import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStudyGroupService } from '../studyGroupService'
import { createFakeHttp } from './fakeHttp'

const fakeHttp = createFakeHttp()

describe('studyGroupService', () => {
  beforeEach(() => vi.clearAllMocks())
  const service = createStudyGroupService(fakeHttp)

  it('getMyGroups GETs /api/study-groups', () => {
    service.getMyGroups()
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/study-groups')
  })

  it('getDetail GETs the group-scoped endpoint', () => {
    service.getDetail('g-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/study-groups/g-1')
  })

  it('create posts name/description', () => {
    service.create({ name: 'Study Buddies', description: 'CS 101' })
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/study-groups', { name: 'Study Buddies', description: 'CS 101' })
  })

  it('join posts the invite code', () => {
    service.join('INVITE1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/study-groups/join', { inviteCode: 'INVITE1' })
  })

  it('leave deletes the leave endpoint', () => {
    service.leave('g-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/study-groups/g-1/leave')
  })

  it('removeMember deletes the member-scoped endpoint', () => {
    service.removeMember('g-1', 'u-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/study-groups/g-1/members/u-1')
  })

  it('shareCourse posts the courseId', () => {
    service.shareCourse('g-1', 'c-1')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/study-groups/g-1/share-course', { courseId: 'c-1' })
  })

  it('unshareCourse deletes the shared-course endpoint', () => {
    service.unshareCourse('g-1', 'c-1')
    expect(fakeHttp.delete).toHaveBeenCalledWith('/api/study-groups/g-1/shared-courses/c-1')
  })

  it('getChat defaults page to 1', () => {
    service.getChat('g-1')
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/study-groups/g-1/chat?page=1')
  })

  it('getChat passes an explicit page', () => {
    service.getChat('g-1', 3)
    expect(fakeHttp.get).toHaveBeenCalledWith('/api/study-groups/g-1/chat?page=3')
  })

  it('sendMessage posts the content', () => {
    service.sendMessage('g-1', 'hello')
    expect(fakeHttp.post).toHaveBeenCalledWith('/api/study-groups/g-1/chat', { content: 'hello' })
  })

})
