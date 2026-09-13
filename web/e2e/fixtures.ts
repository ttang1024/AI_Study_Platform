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
  // AudioDetailPage resolves this doc's courseId from the StudyContext documents list (GET
  // /api/documents), then fetches the rest from GET /api/courses/:courseId/audio/:id separately.
  // Transcript is pre-filled so the page doesn't kick off useAudioDetail's auto-transcribe path,
  // which this fixture doesn't mock.
  {
    documentId: 'doc-audio-lecture',
    courseId: 'course-bio',
    userId: 'user-e2e',
    fileName: 'Neuroscience Lecture.mp3',
    blobUrl: '/fixtures/neuroscience-lecture.mp3',
    contentType: 'audio/mpeg',
    fileSize: 4_500_000,
    summary: 'Neurons communicate through electrochemical signals.',
    mindMapText: null,
    transcript: 'Neurons communicate through electrochemical signals.',
    originalUrl: null,
    createdAt: now,
    updatedAt: now,
  },
]

// Quiz bank keyed by documentId, for the per-document Quiz tab (DocumentQuiz component).
const documentQuizzes: Record<string, { quizId: string; question: string; options: string[]; correctAnswer: string; explanation: string; difficulty: string }[]> = {
  'doc-cells': [
    {
      quizId: 'quiz-cells-1',
      question: 'What organelle generates ATP?',
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi body'],
      correctAnswer: 'Mitochondria',
      explanation: 'Mitochondria perform cellular respiration, producing ATP.',
      difficulty: 'medium',
    },
  ],
}

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
    videoId: 'video-mitosis',
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
    videoId: 'video-mitosis',
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

// Server-side search hits, in the SearchResultItem shape GET /api/search returns. Separate from the
// documents/notes fixtures because the real endpoint searches transcripts and embeddings, so it can
// return things the client-side palette never sees.
const searchResults = [
  {
    id: 'doc-cells',
    type: 'document',
    title: 'Cell Biology.pdf',
    snippet: 'Mitochondria perform cellular respiration and generate ATP.',
    url: '/documents/doc-cells',
  },
]

// The AI answer for POST /api/search/ask, with the [n] citations the page renders.
const askLibraryAnswer = {
  answer: 'Mitochondria generate ATP through cellular respiration [1].',
  citations: [
    { index: 1, type: 'document', id: 'doc-cells', title: 'Cell Biology.pdf', url: '/documents/doc-cells' },
  ],
}

// The Library page reads the unified GET /api/library, not /api/documents + /api/videos.
// These are the merged rows that endpoint returns, in its BackendLibraryItem shape.
interface LibraryRow {
  kind: 'document' | 'video'
  id: string
  courseId: string
  courseName: string
  courseColor: string
  createdAt: string
  fileName?: string
  blobUrl?: string
  contentType?: string
  fileSize?: number
  originalUrl?: string
  summary?: string
  title?: string
  videoId?: string
  videoUrl?: string
  thumbnailUrl?: string
  sourceType?: string
}

const libraryRows: LibraryRow[] = [
  {
    kind: 'document',
    id: 'doc-cells',
    courseId: 'course-bio',
    courseName: 'Biology 101',
    courseColor: '#0d9488',
    createdAt: now,
    fileName: 'Cell Biology.pdf',
    blobUrl: '/fixtures/cell-biology.pdf',
    contentType: 'application/pdf',
    fileSize: 120_000,
    summary: 'Cells are the basic unit of life.',
  },
  {
    kind: 'document',
    id: 'doc-article',
    courseId: 'course-bio',
    courseName: 'Biology 101',
    courseColor: '#0d9488',
    createdAt: now,
    fileName: 'Photosynthesis Article',
    blobUrl: 'https://example.com/photosynthesis',
    contentType: 'text/plain',
    fileSize: 8_000,
    originalUrl: 'https://example.com/photosynthesis',
    summary: 'Photosynthesis converts light into chemical energy.',
  },
  {
    kind: 'document',
    id: 'doc-audio-lecture',
    courseId: 'course-bio',
    courseName: 'Biology 101',
    courseColor: '#0d9488',
    createdAt: now,
    fileName: 'Neuroscience Lecture.mp3',
    blobUrl: '/fixtures/neuroscience-lecture.mp3',
    contentType: 'audio/mpeg',
    fileSize: 4_500_000,
    summary: 'Neurons communicate through electrochemical signals.',
  },
  {
    kind: 'video',
    id: 'video-mitosis',
    courseId: 'course-bio',
    courseName: 'Biology 101',
    courseColor: '#0d9488',
    createdAt: now,
    title: 'Mitosis Explained',
    videoId: 'yt-mitosis',
    videoUrl: 'https://youtube.com/watch?v=yt-mitosis',
    thumbnailUrl: 'https://example.com/mitosis.jpg',
    sourceType: 'youtube',
  },
]

// Documents that exist to exercise the detail page's file viewers. The detail
// page resolves its document from the library list, so they have to be served
// by /api/documents like any other row.
const viewerDocuments = [
  { documentId: 'doc-script', fileName: 'analysis.py', contentType: 'text/plain' },
  { documentId: 'doc-grades', fileName: 'grades.csv', contentType: 'text/csv' },
  { documentId: 'doc-lab', fileName: 'lab.ipynb', contentType: 'application/json' },
  { documentId: 'doc-captions', fileName: 'lecture.srt', contentType: 'text/plain' },
].map(doc => ({
  courseId: 'course-bio',
  userId: 'user-e2e',
  blobUrl: `/fixtures/${doc.fileName}`,
  fileSize: 2_000,
  summary: 'Fixture summary.',
  createdAt: now,
  updatedAt: now,
  ...doc,
}))

// Raw bytes served by GET .../documents/{id}/file for the fixtures above.
const viewerDocumentFiles: Record<string, string> = {
  'doc-script': 'def total(values):\n    # sum them up\n    return sum(values)\n',
  'doc-grades': 'student,score\nAda,99\nAlan,97\n',
  'doc-lab': JSON.stringify({
    cells: [
      { cell_type: 'markdown', source: '# Lab notes' },
      { cell_type: 'code', source: 'print("hi")', execution_count: 1, outputs: [{ output_type: 'stream', text: 'hi\n' }] },
    ],
    metadata: { language_info: { name: 'python' } },
    nbformat: 4,
  }),
  'doc-captions': '1\n00:00:01,000 --> 00:00:04,000\nMitochondria make ATP\n',
  // Not a real mp3 — the audio element never actually plays in these tests, only renders.
  'doc-audio-lecture': 'fixture-audio-bytes',
}

// Mirrors how the server buckets a row for the ?type= filter.
const rowType = (i: LibraryRow): string => {
  if (i.kind === 'video') return 'videos'
  if (i.originalUrl) return 'articles'
  if (i.contentType?.startsWith('audio/')) return 'audio'
  return 'documents'
}

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
    window.localStorage.setItem(
      'sp_user',
      JSON.stringify({ id: 'user-e2e', email: 'student@example.com', name: 'Test Student' }),
    )
  })
}

export async function mockStudyApi(page: Page) {
  // Mutated by the DELETE and review/classify handlers below so later GETs in the same test
  // reflect the write — a mock that always serves the static fixture would let a broken mutation
  // pass by never noticing the list didn't actually change.
  const deletedDocumentIds = new Set<string>()
  const reviewedFlashcards = new Map<string, { rating: number; difficulty: string }>()
  const createdCourses: { courseId: string; userId: string; courseName: string; courseColor: string; createdAt: string; updatedAt: string }[] = []
  let fsrsSettings = {
    desiredRetention: 0.9,
    maximumIntervalDays: 36500,
    enableFuzz: true,
    newCardsPerDay: 20,
    maxReviewsPerDay: 0,
    usingOptimizedWeights: false,
    reviewsAtOptimization: 0,
    weights: [] as number[],
    reviewCount: 12,
    minimumReviewsToOptimize: 200,
  }

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()

    const deleteDocMatch = path.match(/^\/api\/courses\/[^/]+\/documents\/([^/]+)$/)
    if (method === 'DELETE' && deleteDocMatch) {
      deletedDocumentIds.add(deleteDocMatch[1])
      return json(route, true)
    }

    // Scheduler settings: the flashcards page reads these to size the review queue, so the
    // fallback `[]` would leave the queue with a NaN new-card budget.
    if (path === '/api/flashcards/srs/settings') {
      if (method === 'PUT') {
        const patch = route.request().postDataJSON() as Record<string, unknown>
        fsrsSettings = { ...fsrsSettings, ...patch }
      }
      return json(route, fsrsSettings)
    }

    if (path === '/api/flashcards/srs/forecast' && method === 'GET') {
      const days = Number(url.searchParams.get('days') ?? 14)
      return json(route, {
        overdue: 3,
        days: Array.from({ length: days }, (_, i) => ({
          day: new Date(Date.now() + i * 86_400_000).toISOString(),
          count: i % 4,
        })),
        maxReviewsPerDay: fsrsSettings.maxReviewsPerDay,
        newCardsPerDay: fsrsSettings.newCardsPerDay,
      })
    }

    if (path === '/api/flashcards/srs/reschedule-backlog' && method === 'POST') {
      const body = route.request().postDataJSON() as { days: number }
      return json(route, { moved: 3, days: body.days, perDay: 1 })
    }

    if (path === '/api/flashcards/review/undo' && method === 'POST') {
      const body = route.request().postDataJSON() as { flashcardId?: string }
      if (body.flashcardId) reviewedFlashcards.delete(body.flashcardId)
      return json(route, { flashcardId: body.flashcardId ?? '', rating: 3, cardReset: true })
    }

    const reviewMatch = path.match(/^\/api\/flashcards\/([^/]+)\/review$/)
    if (method === 'POST' && reviewMatch) {
      const body = route.request().postDataJSON() as { rating: number }
      reviewedFlashcards.set(reviewMatch[1], { rating: body.rating, difficulty: 'medium' })
      return json(route, {
        scheduledDays: body.rating >= 3 ? 4 : 1,
        retrievability: 0.9,
        srs: {
          state: body.rating === 1 ? 1 : 2,
          stability: 4.2,
          difficulty: 5.5,
          reps: 1,
          lapses: body.rating === 1 ? 1 : 0,
          due: now,
          lastReview: now,
          retrievability: 0.9,
          isSuspended: false,
        },
      })
    }

    const classifyMatch = path.match(/^\/api\/flashcards\/([^/]+)\/classify$/)
    if (method === 'PATCH' && classifyMatch) {
      const card = flashcards.find(f => f.flashcardId === classifyMatch[1])
      return json(route, { ...card, flashcardId: classifyMatch[1], front: card?.front ?? '', back: card?.back ?? '' })
    }

    if (path === '/api/courses' && method === 'POST') {
      const body = route.request().postDataJSON() as { courseName: string; courseColor: string }
      const created = {
        courseId: `course-new-${createdCourses.length + 1}`, userId: 'user-e2e',
        courseName: body.courseName, courseColor: body.courseColor, createdAt: now, updatedAt: now,
      }
      createdCourses.push(created)
      return json(route, created)
    }
    if (path === '/api/courses') return json(route, [...courses, ...createdCourses])
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
    if (path === '/api/documents') {
      const all = [...documents, ...viewerDocuments].filter(d => !deletedDocumentIds.has(d.documentId))
      return json(route, paged(all, Number(url.searchParams.get('pageSize') ?? 500)))
    }
    const singleDocMatch = path.match(/^\/api\/courses\/[^/]+\/documents\/([^/]+)$/)
    if (singleDocMatch) {
      const doc = [...documents, ...viewerDocuments].find(d => d.documentId === singleDocMatch[1])
      if (doc) return json(route, doc)
    }
    const docFileMatch = path.match(/^\/api\/courses\/[^/]+\/documents\/([^/]+)\/file$/)
    if (docFileMatch && viewerDocumentFiles[docFileMatch[1]]) {
      // The viewers read this endpoint as text, not as a BaseResponse envelope.
      return route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: viewerDocumentFiles[docFileMatch[1]],
      })
    }

    const audioMatch = path.match(/^\/api\/courses\/[^/]+\/audio\/([^/]+)$/)
    if (audioMatch) {
      const doc = documents.find(d => d.documentId === audioMatch[1])
      if (doc) return json(route, doc)
    }

    const quizSubmissionMatch = path.match(/^\/api\/courses\/[^/]+\/documents\/([^/]+)\/quiz\/submission$/)
    if (quizSubmissionMatch && method === 'GET') return json(route, null)
    if (quizSubmissionMatch && method === 'POST') {
      const body = route.request().postDataJSON() as { answers: Record<string, string>; score: number; total: number }
      return json(route, {
        submissionId: 'submission-new', documentId: quizSubmissionMatch[1], sourceType: 'document',
        answers: body.answers, score: body.score, total: body.total, submittedAt: now,
      })
    }
    const quizMatch = path.match(/^\/api\/courses\/[^/]+\/documents\/([^/]+)\/quiz$/)
    if (quizMatch && method === 'GET') return json(route, documentQuizzes[quizMatch[1]] ?? [])

    if (path === '/api/videos') return json(route, paged(videos, Number(url.searchParams.get('pageSize') ?? 8)))
    // The add-content video tabs read the lite list (whole library, heavy fields dropped) so they
    // can flag an already-saved link or file.
    if (path === '/api/videos/lite') return json(route, paged(videos, Number(url.searchParams.get('pageSize') ?? 500)))
    const singleVideoMatch = path.match(/^\/api\/videos\/([^/]+)$/)
    if (singleVideoMatch) {
      const video = videos.find(v => v.id === singleVideoMatch[1])
      if (video) return json(route, video)
    }
    if (path === '/api/notes') return json(route, paged(notes, Number(url.searchParams.get('pageSize') ?? 20)))
    if (path === '/api/flashcards') return json(route, paged(flashcards, Number(url.searchParams.get('pageSize') ?? 20)))
    if (path === '/api/flashcards/coverage') return json(route, { documentIds: ['doc-cells'], videoIds: ['video-mitosis'] })
    if (path === '/api/flashcards/pending-materials') return json(route, [])
    if (path === '/api/flashcards/srs') return json(route, [])
    if (path === '/api/quiz-submissions') return json(route, paged(quizSubmissions, Number(url.searchParams.get('pageSize') ?? 20)))
    if (path === '/api/quiz-submissions/coverage') return json(route, { documentIds: ['doc-cells'], videoIds: [] })
    if (path === '/api/quiz-submissions/pending-materials') return json(route, [])
    if (path === '/api/quiz-submissions/generated-materials') return json(route, [])
    if (path === '/api/question-bank') return json(route, questionBank)
    if (path === '/api/glossary') return json(route, paged([], 20))
    if (path === '/api/search/ask') return json(route, askLibraryAnswer)
    // The search page reads res.items, so the [] fallback blanked it the moment a query ran. Matching
    // ?q= keeps the empty-state assertions honest.
    if (path === '/api/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const hits = searchResults.filter(r => `${r.title} ${r.snippet}`.toLowerCase().includes(q))
      return json(route, { items: hits, totalCount: hits.length, page: 1, pageSize: 20 })
    }
    if (path === '/api/study-groups') return json(route, [])

    // Everything below renders in the shared app shell or on the dashboard, so every
    // authenticated page hits it. Each needs its real object shape — the [] fallback
    // at the end of this handler is truthy and slips past the components' null-checks.
    if (path === '/api/notifications') return json(route, { items: [], count: 0 })
    if (path === '/api/recommendations/today') {
      return json(route, {
        streak: { currentStreak: 3, longestStreak: 7, lastStudiedOn: now },
        dailyGoalMinutes: 30,
        todayMinutes: 12,
        completionPercent: 40,
        goalMet: false,
        plannedMinutes: 25,
        dueFlashcards: 2,
        items: [],
        generatedAt: now,
      })
    }
    if (path === '/api/stats/xp') {
      return json(route, {
        totalXp: 1250,
        level: 4,
        xpIntoLevel: 250,
        xpForNextLevel: 500,
        levelProgress: 0.5,
        breakdown: [{ label: 'Flashcards', xp: 800 }],
      })
    }
    if (path === '/api/notifications/weekly-digest') {
      return json(route, {
        from: now,
        to: now,
        headline: 'A steady week of study.',
        studyMinutes: 120,
        activeDays: 4,
        dailyMinutes: [{ day: 'Mon', minutes: 30 }],
        flashcardReviews: 12,
        quizzesTaken: 2,
        quizAccuracy: 80,
        currentStreak: 3,
      })
    }

    // Insights tabs. Same reason as the block above: an unmocked endpoint falls through to the []
    // at the bottom of this handler, which several of these components dereference as an object
    // (data.days, data.bins, data.forgettingCurve, …) and crash on — see ActivityHeatmapSection,
    // CalibrationSection, RetentionSection, AnalyticsSection.
    if (path === '/api/analytics/activity-heatmap') {
      return json(route, {
        from: now, to: now, days: [], totalReviews: 0, totalStudyMinutes: 0, activeDays: 0,
      })
    }
    if (path === '/api/analytics/retention') {
      return json(route, {
        totalCardsTracked: 0, totalReviews: 0, reviewsLast30Days: 0,
        predictedRetentionNow: 0, actualRetentionRate: 0, averageStability: 0, averageDifficulty: 0,
        forgettingCurve: [], calibration: [], dailyReviews: [], stabilityDistribution: [],
      })
    }
    if (path === '/api/analytics/calibration') {
      return json(route, {
        bins: [], ratedAnswers: 0, confidentWrong: 0, guessedRight: 0,
        overconfidenceGap: null, confidentMistakes: [],
      })
    }
    if (path === '/api/analytics/quiz-accuracy') return json(route, [])
    if (path === '/api/analytics/time-on-task') {
      return json(route, { totalSeconds: 0, daily: [], byCourse: [] })
    }
    if (path === '/api/analytics/course-mastery') return json(route, [])

    // Security tab. These need their real object shapes for the same reason as the block above:
    // the [] fallback is truthy, so `data.items` comes back undefined and the pager crashes on it.
    if (path === '/api/security/2fa') {
      return json(route, { enabled: false, enabledAt: null, recoveryCodesRemaining: 0 })
    }
    if (path === '/api/security/sessions') {
      return json(route, [
        {
          sessionId: 'session-current',
          deviceName: 'Chrome on macOS',
          ipAddress: '203.0.113.7',
          startedAt: now,
          lastUsedAt: now,
          expiresAt: now,
          isCurrent: true,
        },
      ])
    }
    if (path === '/api/security/audit-log') {
      return json(route, {
        items: [
          {
            auditLogEntryId: 'audit-1',
            action: 'auth.login.succeeded',
            actorUserId: 'user-1',
            subjectUserId: 'user-1',
            targetType: null,
            targetId: null,
            metadataJson: null,
            ipAddress: '203.0.113.7',
            userAgent: null,
            createdAt: now,
          },
        ],
        page: 1,
        pageSize: 25,
        totalCount: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      })
    }
    if (path === '/api/security/exports') return json(route, [])
    if (path === '/api/library/tags') return json(route, [])
    if (path === '/api/library/views') return json(route, [])
    if (path === '/api/certificates') return json(route, [])
    if (path === '/api/certificates/eligibility') return json(route, [])
    if (path === '/api/peer-reviews') return json(route, [])
    if (path === '/api/integrations/api-keys') return json(route, [])
    if (path === '/api/integrations/webhooks') return json(route, [])

    // Filtering/searching/paging are server-side for the real endpoint, so the mock
    // has to honour ?type= and ?search= or the Library filter tests cannot pass.
    if (path === '/api/library') {
      const type = url.searchParams.get('type') ?? 'all'
      const search = (url.searchParams.get('search') ?? '').toLowerCase()
      const page = Number(url.searchParams.get('page') ?? 1)
      const pageSize = Number(url.searchParams.get('pageSize') ?? 8)

      let rows = libraryRows.filter(i => !deletedDocumentIds.has(i.id))
      if (type !== 'all') rows = rows.filter(i => rowType(i) === type)
      if (search) rows = rows.filter(i => (i.fileName ?? i.title ?? '').toLowerCase().includes(search))

      const start = (page - 1) * pageSize
      return json(route, {
        items: rows.slice(start, start + pageSize),
        totalCount: rows.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      })
    }

    return json(route, [])
  })
}

export async function setupAuthenticatedStudyApp(page: Page) {
  await signInForE2E(page)
  await mockStudyApi(page)
}
