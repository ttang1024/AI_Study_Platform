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
    if (path === '/api/documents') {
      const all = [...documents, ...viewerDocuments]
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
    if (path === '/api/videos') return json(route, paged(videos, Number(url.searchParams.get('pageSize') ?? 8)))
    // The add-content video tabs read the lite list (whole library, heavy fields dropped) so they
    // can flag an already-saved link or file.
    if (path === '/api/videos/lite') return json(route, paged(videos, Number(url.searchParams.get('pageSize') ?? 500)))
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

      let rows = libraryRows
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
