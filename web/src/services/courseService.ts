import { apiClient } from './apiClient';
import { Course } from '../types';

interface BackendCourse {
  courseId: string;
  userId: string;
  courseName: string;
  courseColor: string;
  createdAt: string;
  updatedAt: string;
}

const mapCourse = (bc: BackendCourse): Course => ({
  id: bc.courseId,
  name: bc.courseName,
  color: bc.courseColor,
});

export const courseService = {
  async getCourses(): Promise<Course[]> {
    const response = await apiClient.get('/api/courses');
    return (response.data.data as BackendCourse[]).map(mapCourse);
  },

  async getCourse(courseId: string): Promise<Course> {
    const response = await apiClient.get(`/api/courses/${courseId}`);
    return mapCourse(response.data.data);
  },

  async createCourse(data: { courseName: string; courseColor: string }): Promise<Course> {
    const response = await apiClient.post('/api/courses', data);
    return mapCourse(response.data.data);
  },

  async updateCourse(courseId: string, data: { courseName: string; courseColor: string }): Promise<Course> {
    const response = await apiClient.put(`/api/courses/${courseId}`, data);
    return mapCourse(response.data.data);
  },

  async deleteCourse(courseId: string): Promise<void> {
    await apiClient.delete(`/api/courses/${courseId}`);
  },
};
