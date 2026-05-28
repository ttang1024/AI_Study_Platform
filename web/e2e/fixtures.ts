import { Page, Route } from '@playwright/test'

const now = '2026-05-23T10:00:00.000Z'

const courses = [
  {
    courseId: 'course-bio',
    userId: 'user-e2e',
    courseName: 'Biology 101',
    courseColor: '#0d9488',
    createdAt: now,
    updatedAt: now,
  },
  {
    courseId: 'course-math',
    userId: 'user-e2e',
    courseName: 'Calculus',
    courseColor: '#2563eb',
    createdAt: now,
    updatedAt: now,
  },
]

const documents = [
  {
    documentId: 'doc-cells',
    courseId: 'course-bio',
    userId: 'user-e2e',
    fileName: 'Cell Biology.pdf',
    blobUrl: '/fixtures/cell-biology.pdf',
    contentType: 'application/pdf',
    fileSize: 120_000,
    summary: 'Cells are the basic unit of life.',
    createdAt: now,
    updatedAt: now,
  },
  {
    documentId: 'doc-article',
    courseId: 'course-bio',
    userId: 'user-e2e',
    fileName: 'Photosynthesis Article',
    blobUrl: 'https://example.com/photosynthesis',
    contentType: 'text/plain',
    fileSize: 8_000,
    originalUrl: 'https://example.com/photosynthesis',
    summary: 'Photosynthesis converts light into chemical energy.',
    createdAt: now,
    updatedAt: now,
  },
]

const videos = [
  {
    id: 'video-mitosis',
    courseId: 'course-bio',
    courseName: 'Biology 101',
    courseColor: '#0d9488',
    videoId: 'yt-mitosis',
    videoUrl: 'https://youtube.com/watch?v=yt-mitosis',
    title: 'Mitosis Explained',
    thumbnailUrl: 'https://example.com/mitosis.jpg',
    summary: 'Mitosis creates identical daughter cells.',
    noteContent: null,
    flashcardsJson: null,
    quizJson: null,
    createdAt: now,
  },
]

const notes = [
  {
    noteId: 'note-cells',
    documentId: 'doc-cells',
    title: 'Cell Biology.pdf',
    content: '<p>Remember that mitochondria generate ATP.</p>',
    document: 'Cell Biology.pdf',
    createdAt: now,
    updatedAt: now,
  },
  {
    noteId: 'note-video',
    youTubeVideoId: 'video-mitosis',
    title: 'Mitosis Explained',
    content: '<p>Mitosis has prophase, metaphase, anaphase, and telophase.</p>',
    video: 'Mitosis Explained',
    createdAt: now,
    updatedAt: now,
  },
]

const flashcards = [
  {
    flashcardId: 'flashcard-cell',
    documentId: 'doc-cells',
    document: 'Cell Biology.pdf',
    front: 'What organelle generates ATP?',
    back: 'Mitochondria',
    cardType: 'basic',
    difficulty: 'medium',
    chapter: 'Cell structure',
    tags: ['biology'],
    srs: {
      state: 0,
      stability: 1,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      due: now,
      retrievability: 1,
    },
  },
  {
    flashcardId: 'flashcard-mitosis',
    youTubeVideoId: 'video-mitosis',
    video: 'Mitosis Explained',
    front: 'What happens during anaphase?',
    back: 'Sister chromatids separate.',
    cardType: 'basic',
    difficulty: 'hard',
    chapter: 'Cell division',
    tags: ['mitosis'],
  },
]

const quizSubmissions = [
  {
    submissionId: 'quiz-cells',
    documentId: 'doc-cells',
    sourceType: 'document',
    title: 'Cell Biology.pdf',
    document: 'Cell Biology.pdf',
    answers: { q1: 'A' },
    score: 4,
    total: 5,
    submittedAt: now,
  },
]

const questionBank = [
  {
    quizId: 'question-cell',
    documentId: 'doc-cells',
    courseId: 'course-bio',
    sourceType: 'document',
    sourceName: 'Cell Biology.pdf',
    courseName: 'Biology 101',
    courseColor: '#0d9488',
    question: 'Which organelle makes ATP?',
    options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi body'],
    correctAnswer: 'Mitochondria',
    explanation: 'Mitochondria perform cellular respiration.',
    difficulty: 'medium',
    createdAt: now,
  },
]

const paged = <T>(items: T[], pageSize = items.length || 10) => ({
  items,
  totalCount: items.length,
  page: 1,
  pageSize,
  totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
})

const json = (route: Route, data: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data }),
  })

export async function signInForE2E(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sp_access_token', 'e2e-access-token')
    window.localStorage.setItem('sp_refresh_token', 'e2e-refresh-token')
    window.localStorage.setItem(
      'sp_user',
      JSON.stringify({ id: 'user-e2e', email: 'student@example.com', name: 'Test Student' }),
    )
  })
}

export async function mockStudyApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path === '/api/courses') return json(route, courses)
    if (path === '/api/stats') {
      return json(route, {
        totalDocuments: 1,
        totalArticles: 1,
        totalAudio: 0,
        totalMaterials: 3,
        totalNotes: 2,
        totalFlashcards: 2,
        totalGlossaryTerms: 1,
        totalQuizQuestions: 1,
        totalQuizSubmissions: 1,
        totalVideos: 1,
        courseMaterialCounts: [
          { courseId: 'course-bio', documents: 1, articles: 1, audio: 0, videos: 1, total: 3 },
          { courseId: 'course-math', documents: 0, articles: 0, audio: 0, videos: 0, total: 0 },
        ],
        achievements: { perfectQuizzes: 0, averageQuizScore: 80, flashcardsMastered: 0 },
      })
    }
    if (path === '/api/documents') return json(route, paged(documents, Number(url.searchParams.get('pageSize') ?? 500)))
    const singleDocMatch = path.match(/^\/api\/courses\/[^/]+\/documents\/([^/]+)$/)
    if (singleDocMatch) {
      const doc = documents.find(d => d.documentId === singleDocMatch[1])
      if (doc) return json(route, doc)
    }
    if (path === '/api/videos') return json(route, paged(videos, Number(url.searchParams.get('pageSize') ?? 8)))
    if (path === '/api/notes') return json(route, paged(notes, Number(url.searchParams.get('pageSize') ?? 20)))
    if (path === '/api/flashcards') return json(route, paged(flashcards, Number(url.searchParams.get('pageSize') ?? 20)))
    if (path === '/api/flashcards/coverage') return json(route, { documentIds: ['doc-cells'], youTubeVideoIds: ['video-mitosis'] })
    if (path === '/api/flashcards/pending-materials') return json(route, [])
    if (path === '/api/flashcards/srs') return json(route, [])
    if (path === '/api/quiz-submissions') return json(route, paged(quizSubmissions, Number(url.searchParams.get('pageSize') ?? 20)))
    if (path === '/api/quiz-submissions/coverage') return json(route, { documentIds: ['doc-cells'], youTubeVideoIds: [] })
    if (path === '/api/quiz-submissions/pending-materials') return json(route, [])
    if (path === '/api/quiz-submissions/generated-materials') return json(route, [])
    if (path === '/api/question-bank') return json(route, questionBank)
    if (path === '/api/glossary') return json(route, paged([], 20))
    if (path === '/api/search') return json(route, [])
    if (path === '/api/study-groups') return json(route, [])

    return json(route, [])
  })
}

export async function setupAuthenticatedStudyApp(page: Page) {
  await signInForE2E(page)
  await mockStudyApi(page)
}
