# Courses

## Overview

Courses group documents and YouTube videos. Most generated artifacts remain source-scoped, while the course study page aggregates artifacts for review.

## Routes

`CoursesController` is mounted at `/api/courses`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/courses` | List current user's courses |
| `GET` | `/api/courses/{courseId}` | Course detail |
| `POST` | `/api/courses` | Create course |
| `PUT` | `/api/courses/{courseId}` | Update course |
| `DELETE` | `/api/courses/{courseId}` | Delete course |

Document routes are nested under `/api/courses/{courseId}/documents`. Audio upload routes are nested under `/api/courses/{courseId}/audio`.

## Implementation

Course CRUD handlers live under `server/StudyPlatform.Application/Courses`. The pattern is the same for create, update, and delete: verify ownership before mutating.

```csharp
// CoursesController.cs — ownership guard used by update/delete
var course = await _unitOfWork.Courses.GetByIdAsync(courseId, ct);
if (course == null || course.UserId != userId)
    return NotFound(BaseResponse.Fail("Course not found."));
```

When a course is deleted, EF cascade rules remove all nested documents, YouTube videos, quizzes, flashcards, glossary terms, notes, and chat messages automatically via `DeleteBehavior.Cascade` on the foreign keys.

## Frontend

| File | Role |
| --- | --- |
| `DashboardPage.tsx` | Course cards and overview |
| `CourseStudyPage.tsx` | Course study workspace |
| `CourseArtifactsWorkspace.tsx` | Aggregated artifacts |
| `CoursePicker.tsx` / `MoveToCourseModal.tsx` | Source organization |
| `courseService.ts` | API client |
