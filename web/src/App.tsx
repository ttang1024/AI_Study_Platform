import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider } from './i18n';
import { StudyProvider } from './context/StudyContext';
import { TtsProvider } from './context/TtsContext';
import { MainLayout } from './components/layout/MainLayout';
import { PromptProvider } from './components/common/PromptBox';
import { PomodoroTimer } from './components/common/PomodoroTimer';
// Public/auth pages stay eager so first paint never waits on a second request.
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';

// All authenticated pages are lazy so heavy dependencies (d3/markmap, katex,
// tiptap, pdf/docx viewers, export libs) load with the page that uses them
// instead of in the entry chunk.
const lazyPage = <T extends Record<string, React.ComponentType<any>>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(() => loader().then((mod) => ({ default: mod[name] })));

// The landing page is lazy too — it drags the whole motion/react animation stack
// (~100 KB gzip) plus the bento cards into whatever chunk holds it, and signed-in
// loads never render it. Anonymous visitors start fetching it immediately (in
// parallel with app bootstrap) so their first paint still waits on ~one request.
const landingLoader = () => import('./pages/LandingPage');
if (!localStorage.getItem('sp_access_token')) void landingLoader();
const LandingPage = lazyPage(landingLoader, 'LandingPage');

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const LibraryPage = lazyPage(() => import('./pages/LibraryPage'), 'LibraryPage');
// Adding content (the old AI Summarizer) is its own page, not a Library tab.
const AddContentPage = lazyPage(() => import('./pages/AddContentPage'), 'AddContentPage');
// Practice Center = practice + planner + quiz history + mistakes + question bank.
const QuizManagementPage = lazyPage(() => import('./pages/QuizManagementPage'), 'QuizManagementPage');
const FlashcardsPage = lazyPage(() => import('./pages/FlashcardsPage'), 'FlashcardsPage');
// Materials = notes + glossary.
const MaterialsPage = lazyPage(() => import('./pages/MaterialsPage'), 'MaterialsPage');
// Settings gained the Feedback tab.
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage');
const VideoDetailPage = lazyPage(() => import('./pages/VideoDetailPage'), 'VideoDetailPage');
const ArticlePage = lazyPage(() => import('./pages/ArticlePage'), 'ArticlePage');
const AudioDetailPage = lazyPage(() => import('./pages/AudioDetailPage'), 'AudioDetailPage');
const SearchResultsPage = lazyPage(() => import('./pages/SearchResultsPage'), 'SearchResultsPage');
// Spaces = study groups + classrooms.
const SpacesPage = lazyPage(() => import('./pages/SpacesPage'), 'SpacesPage');
const StudyGroupDetailPage = lazyPage(() => import('./pages/StudyGroupDetailPage'), 'StudyGroupDetailPage');
const ToolsPage = lazyPage(() => import('./pages/ToolsPage'), 'ToolsPage');
const ClassroomDetailPage = lazyPage(() => import('./pages/ClassroomDetailPage'), 'ClassroomDetailPage');
const ChatListPage = lazyPage(() => import('./pages/ChatListPage'), 'ChatListPage');
// Insights gained the Concept map tab (the old /knowledge-graph page).
const InsightsPage = lazyPage(() => import('./pages/InsightsPage'), 'InsightsPage');
const OfflinePage = lazyPage(() => import('./pages/OfflinePage'), 'OfflinePage');
const DocumentDetailsPage = lazyPage(() => import('./pages/DocumentDetailsPage'), 'DocumentDetailsPage');
const CourseStudyPage = lazyPage(() => import('./pages/CourseStudyPage'), 'CourseStudyPage');
const SharedContentPage = lazyPage(() => import('./pages/SharedContentPage'), 'SharedContentPage');

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

/**
 * Browse and Add were two tabs of /library; Add is its own page now. `?view=add` links minted while
 * they were tabs (and anything still bookmarked) follow it, keeping the params the form reads.
 */
const LibraryRoute: React.FC = () => {
  const [params] = useSearchParams();
  if (params.get('view') !== 'add') return <LibraryPage />;
  const next = new URLSearchParams(params);
  next.delete('view');
  const query = next.toString();
  return <Navigate to={`/library/add${query ? `?${query}` : ''}`} replace />;
};

/** The Code scratchpad left the Practice Center for /tools; old deep links follow it. */
const QuizzesRoute: React.FC = () => {
  const [params] = useSearchParams();
  if (params.get('tab') === 'code') return <Navigate to="/tools?tab=code" replace />;
  return <QuizManagementPage />;
};

/**
 * A retired page's route, kept alive as a redirect into the tab that replaced it. Existing query
 * params ride along, so /practice?smart=1 and /summarizer?tab=web&courseId=… still do what they did.
 * `extra` sets the params that select the tab; anything already in the URL wins over it only when
 * the retired page owned that param itself (the summarizer's `tab`), which is why `extra` is applied
 * first and the incoming params are merged on top.
 */
const TabRedirect: React.FC<{ to: string; extra?: Record<string, string> }> = ({ to, extra }) => {
  const [params] = useSearchParams();
  const next = new URLSearchParams(extra);
  params.forEach((value, key) => next.set(key, value));
  const query = next.toString();
  return <Navigate to={query ? `${to}?${query}` : to} replace />;
};

export default function App() {
  return (
    <I18nProvider>
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
                    <Route path="tools" element={<ToolsPage />} />
                    {/* Check Working / Writing / Language were three pages; they are tabs of /tools now. */}
                    <Route path="handwriting" element={<Navigate to="/tools?tab=working" replace />} />
                    <Route path="essays" element={<Navigate to="/tools?tab=writing" replace />} />
                    <Route path="language" element={<Navigate to="/tools?tab=language" replace />} />

                    {/* Library — browse what you have; adding content is the page next door. */}
                    <Route path="library" element={<LibraryRoute />} />
                    <Route path="library/add" element={<AddContentPage />} />
                    <Route path="documents" element={<Navigate to="/library" replace />} />
                    <Route path="videos" element={<Navigate to="/library?type=videos" replace />} />
                    <Route path="youtube" element={<Navigate to="/videos" replace />} />
                    <Route path="summarizer" element={<TabRedirect to="/library/add" />} />

                    {/* Practice Center — practice, planner, quiz history, mistakes, bank. */}
                    <Route path="quizzes" element={<QuizzesRoute />} />
                    <Route path="practice" element={<TabRedirect to="/quizzes" extra={{ tab: 'practice' }} />} />
                    <Route path="planner" element={<TabRedirect to="/quizzes" extra={{ tab: 'planner' }} />} />
                    <Route path="mistakes" element={<TabRedirect to="/quizzes" extra={{ tab: 'mistakes' }} />} />

                    {/* Study materials — notes + glossary. */}
                    <Route path="materials" element={<MaterialsPage />} />
                    <Route path="notes" element={<TabRedirect to="/materials" extra={{ tab: 'notes' }} />} />
                    <Route path="glossary" element={<TabRedirect to="/materials" extra={{ tab: 'glossary' }} />} />

                    <Route path="flashcards" element={<FlashcardsPage />} />

                    {/* Insights — analytics, retention, reinforcement, concept map. */}
                    <Route path="insights" element={<InsightsPage />} />
                    <Route path="analytics" element={<Navigate to="/insights" replace />} />
                    <Route path="knowledge-graph" element={<TabRedirect to="/insights" extra={{ tab: 'graph' }} />} />
                    <Route path="reinforcement-center" element={<ReinforcementRedirect />} />

                    {/* Shared spaces — study groups + classrooms. */}
                    <Route path="spaces" element={<SpacesPage />} />
                    <Route path="groups" element={<TabRedirect to="/spaces" extra={{ tab: 'groups' }} />} />
                    <Route path="classrooms" element={<TabRedirect to="/spaces" extra={{ tab: 'classrooms' }} />} />
                    <Route path="classrooms/:id" element={<ClassroomDetailPage />} />

                    <Route path="settings" element={<SettingsPage />} />
                    {/* Feedback was its own page; it is a Settings tab now. */}
                    <Route path="feedback" element={<TabRedirect to="/settings" extra={{ tab: 'feedback' }} />} />
                    <Route path="offline" element={<OfflinePage />} />
                    <Route path="search" element={<SearchResultsPage />} />
                    <Route path="chat" element={<ChatListPage />} />
                    {/* The tutor lives in AI Chat. */}
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
    </I18nProvider>
  );
}
