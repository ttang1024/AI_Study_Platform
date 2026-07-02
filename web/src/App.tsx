import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudyProvider } from './context/StudyContext';
import { TtsProvider } from './context/TtsContext';
import { MainLayout } from './components/layout/MainLayout';
import { PromptProvider } from './components/common/PromptBox';
import { PomodoroTimer } from './components/common/PomodoroTimer';
// Public/auth pages stay eager so first paint never waits on a second request.
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { LandingPage } from './pages/LandingPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';

// All authenticated pages are lazy so heavy dependencies (d3/markmap, katex,
// tiptap, pdf/docx viewers, export libs) load with the page that uses them
// instead of in the entry chunk.
const lazyPage = <T extends Record<string, React.ComponentType<any>>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(() => loader().then((mod) => ({ default: mod[name] })));

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const LibraryPage = lazyPage(() => import('./pages/LibraryPage'), 'LibraryPage');
const QuizManagementPage = lazyPage(() => import('./pages/QuizManagementPage'), 'QuizManagementPage');
const FlashcardsPage = lazyPage(() => import('./pages/FlashcardsPage'), 'FlashcardsPage');
const NotesPage = lazyPage(() => import('./pages/NotesPage'), 'NotesPage');
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage');
const VideoDetailPage = lazyPage(() => import('./pages/VideoDetailPage'), 'VideoDetailPage');
const AISummarizerPage = lazyPage(() => import('./pages/AISummarizerPage'), 'AISummarizerPage');
const GlossaryPage = lazyPage(() => import('./pages/GlossaryPage'), 'GlossaryPage');
const FeedbackPage = lazyPage(() => import('./pages/FeedbackPage'), 'FeedbackPage');
const ArticlePage = lazyPage(() => import('./pages/ArticlePage'), 'ArticlePage');
const AudioDetailPage = lazyPage(() => import('./pages/AudioDetailPage'), 'AudioDetailPage');
const SearchResultsPage = lazyPage(() => import('./pages/SearchResultsPage'), 'SearchResultsPage');
const StudyGroupsPage = lazyPage(() => import('./pages/StudyGroupsPage'), 'StudyGroupsPage');
const StudyGroupDetailPage = lazyPage(() => import('./pages/StudyGroupDetailPage'), 'StudyGroupDetailPage');
const ChatListPage = lazyPage(() => import('./pages/ChatListPage'), 'ChatListPage');
const KnowledgeGraphPage = lazyPage(() => import('./pages/KnowledgeGraphPage'), 'KnowledgeGraphPage');
const InsightsPage = lazyPage(() => import('./pages/InsightsPage'), 'InsightsPage');
const OfflinePage = lazyPage(() => import('./pages/OfflinePage'), 'OfflinePage');
const DocumentDetailsPage = lazyPage(() => import('./pages/DocumentDetailsPage'), 'DocumentDetailsPage');
const CourseStudyPage = lazyPage(() => import('./pages/CourseStudyPage'), 'CourseStudyPage');
const SharedContentPage = lazyPage(() => import('./pages/SharedContentPage'), 'SharedContentPage');
const PlannerPage = lazyPage(() => import('./pages/PlannerPage'), 'PlannerPage');
const PracticePage = lazyPage(() => import('./pages/PracticePage'), 'PracticePage');

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const LegacyYouTubeRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/videos/${id}` : '/library?type=videos'} replace />;
};

// Reinforcement Center was merged into the Insights page as a tab. Preserve the
// old ?tab=quiz|glossary|flashcards deep links by mapping them onto ?module=.
const ReinforcementRedirect: React.FC = () => {
  const [params] = useSearchParams();
  const module = params.get('tab');
  const suffix = (module === 'quiz' || module === 'glossary' || module === 'flashcards') ? `&module=${module}` : '';
  return <Navigate to={`/insights?tab=reinforcement${suffix}`} replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <StudyProvider>
        <PromptProvider>
          <TtsProvider>
            <BrowserRouter>
              <Suspense fallback={null}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify-email" element={<EmailVerificationPage />} />

                  <Route path="/" element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="dashboard" element={<DashboardPage />} />
                    {/* The Today plan now lives as the dashboard hero + the Insights → Analytics tab. */}
                    <Route path="today" element={<Navigate to="/dashboard" replace />} />
                    <Route path="practice" element={<PracticePage />} />
                    <Route path="library" element={<LibraryPage />} />
                    <Route path="documents" element={<Navigate to="/library" replace />} />
                    <Route path="videos" element={<Navigate to="/library?type=videos" replace />} />
                    <Route path="youtube" element={<Navigate to="/videos" replace />} />
                    <Route path="summarizer" element={<AISummarizerPage />} />
                    <Route path="flashcards" element={<FlashcardsPage />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="quizzes" element={<QuizManagementPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="glossary" element={<GlossaryPage />} />
                    <Route path="knowledge-graph" element={<KnowledgeGraphPage />} />
                    <Route path="insights" element={<InsightsPage />} />
                    <Route path="analytics" element={<Navigate to="/insights" replace />} />
                    <Route path="offline" element={<OfflinePage />} />
                    <Route path="reinforcement-center" element={<ReinforcementRedirect />} />
                    <Route path="feedback" element={<FeedbackPage />} />
                    <Route path="search" element={<SearchResultsPage />} />
                    <Route path="groups" element={<StudyGroupsPage />} />
                    <Route path="chat" element={<ChatListPage />} />
                    {/* The mistake notebook lives in the Quiz Center; the tutor lives in AI Chat. */}
                    <Route path="mistakes" element={<Navigate to="/quizzes?tab=mistakes" replace />} />
                    <Route path="planner" element={<PlannerPage />} />
                    <Route path="tutor" element={<Navigate to="/chat?tab=teach-back" replace />} />
                  </Route>

                  <Route path="/documents/:id" element={
                    <ProtectedRoute>
                      <DocumentDetailsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/videos/:id" element={
                    <ProtectedRoute>
                      <VideoDetailPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/youtube/:id" element={<LegacyYouTubeRedirect />} />
                  <Route path="/articles/:id" element={
                    <ProtectedRoute>
                      <ArticlePage />
                    </ProtectedRoute>
                  } />
                  <Route path="/audio/:id" element={
                    <ProtectedRoute>
                      <AudioDetailPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/groups/:id" element={
                    <ProtectedRoute>
                      <StudyGroupDetailPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/courses/:courseId/study" element={
                    <ProtectedRoute>
                      <CourseStudyPage />
                    </ProtectedRoute>
                  } />

                  <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                  <Route path="/share/:token" element={<SharedContentPage />} />
                </Routes>
              </Suspense>
              <PomodoroTimer />
            </BrowserRouter>
          </TtsProvider>
        </PromptProvider>
      </StudyProvider>
    </AuthProvider>
  );
}
