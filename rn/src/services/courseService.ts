import { apiClient } from '@/services/apiClient';
import type { Course } from '@/types';

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

export const courseService = {
  async getCourses(): Promise<Course[]> {
    const response = await apiClient.get('/api/courses');
    return (response.data.data as BackendCourse[]).map(mapCourse);
  },
};
