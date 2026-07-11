import type { PlanTask } from '@/services/plannerService';

// PlanTask.url is a web route (e.g. `/quizzes?tab=mistakes`) — same problem Phase 1's Dashboard
// solved for TodayPlanItem. Map by `type` to an RN route instead of parsing the web URL string.
export const routeForTask = (task: PlanTask): string => {
  switch (task.type) {
    case 'flashcards':
      return '/study/flashcards';
    case 'review':
      return '/study/flashcards/review';
    case 'concept':
      return '/study/glossary';
    case 'mock-exam':
      return '/study/planner/mock-exam';
    case 'mistakes':
    case 'practice':
    default:
      return '/study/quizzes';
  }
};
