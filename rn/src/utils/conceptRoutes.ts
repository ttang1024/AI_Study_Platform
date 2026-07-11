import type { useRouter } from 'expo-router';

import type { ConceptNode } from '@/services/conceptLinksService';

// Node ids are prefixed `type:rawId` (e.g. `document:<guid>`). `url` is a web route we don't use —
// same type-based remapping approach as Phase 1's Dashboard/Planner routing helpers.
export const routeForNode = (node: ConceptNode, router: ReturnType<typeof useRouter>): void => {
  const rawId = node.id.slice(node.type.length + 1);
  switch (node.type) {
    case 'document':
    case 'article':
    case 'audio':
    case 'podcast':
      if (node.courseId) {
        router.push({ pathname: '/library/document/[id]', params: { id: rawId, courseId: node.courseId } }, { withAnchor: true });
      } else {
        router.push({ pathname: '/library', params: { q: node.title } });
      }
      return;
    case 'video':
      router.push({ pathname: '/library/video/[id]', params: { id: rawId } }, { withAnchor: true });
      return;
    case 'note':
      router.push('/study/notes');
      return;
    case 'quiz':
      router.push('/study/quizzes');
      return;
    case 'flashcard':
      router.push('/study/flashcards');
      return;
    case 'concept':
    default:
      router.push('/study/glossary');
  }
};
