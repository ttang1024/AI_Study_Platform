import { useState } from 'react';
import { Course } from '../../types';
import { courseService } from '../../services/courseService';

/** Course list + CRUD. Fully independent of the other library slices. */
export function useCoursesSlice() {
  const [courses, setCourses] = useState<Course[]>([]);

  const addCourse = async (name: string, color: string): Promise<void> => {
    const newCourse = await courseService.createCourse({ courseName: name, courseColor: color });
    setCourses((prev) => [...prev, newCourse]);
  };

  const updateCourse = async (id: string, name: string, color: string): Promise<void> => {
    const updated = await courseService.updateCourse(id, { courseName: name, courseColor: color });
    setCourses((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const deleteCourse = async (id: string): Promise<void> => {
    await courseService.deleteCourse(id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  return { courses, setCourses, addCourse, updateCourse, deleteCourse };
}
