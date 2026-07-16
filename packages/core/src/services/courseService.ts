import type { HttpClient } from '../http';
import type { Course } from '../types';

// The backend payload carries more fields (userId/createdAt/updatedAt); we only
// map the three the UI needs.
interface BackendCourse {
  courseId: string;
  courseName: string;
  courseColor: string;
}

const mapCourse = (bc: BackendCourse): Course => ({
  id: bc.courseId,
  name: bc.courseName,
  color: bc.courseColor,
});

export function createCourseService(http: HttpClient) {
  return {
    async getCourses(): Promise<Course[]> {
      const response = await http.get<{ data: BackendCourse[] }>('/api/courses');
      return response.data.data.map(mapCourse);
    },

    async getCourse(courseId: string): Promise<Course> {
      const response = await http.get<{ data: BackendCourse }>(`/api/courses/${courseId}`);
      return mapCourse(response.data.data);
    },

    async createCourse(data: { courseName: string; courseColor: string }): Promise<Course> {
      const response = await http.post<{ data: BackendCourse }>('/api/courses', data);
      return mapCourse(response.data.data);
    },

    async updateCourse(
      courseId: string,
      data: { courseName: string; courseColor: string },
    ): Promise<Course> {
      const response = await http.put<{ data: BackendCourse }>(`/api/courses/${courseId}`, data);
      return mapCourse(response.data.data);
    },

    async deleteCourse(courseId: string): Promise<void> {
      await http.delete(`/api/courses/${courseId}`);
    },
  };
}

export type CourseService = ReturnType<typeof createCourseService>;
