import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudyProvider } from './context/StudyContext';
import { TtsProvider } from './context/TtsContext';
import { MainLayout } from './components/layout/MainLayout';
import { PromptProvider } from './components/common/PromptBox';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { QuizManagementPage } from './pages/QuizManagementPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { NotesPage } from './pages/NotesPage';
import { SettingsPage } from './pages/SettingsPage';
import { VideoDetailPage } from './pages/VideoDetailPage';
import { AISummarizerPage } from './pages/AISummarizerPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { LandingPage } from './pages/LandingPage';
import { GlossaryPage } from './pages/GlossaryPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { ArticlePage } from './pages/ArticlePage';
import { AudioDetailPage } from './pages/AudioDetailPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { StudyGroupsPage } from './pages/StudyGroupsPage';
import { StudyGroupDetailPage } from './pages/StudyGroupDetailPage';
import { ChatListPage } from './pages/ChatListPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { ReinforcementCenterPage } from './pages/ReinforcementCenterPage';

const DocumentDetailsPage = lazy(() =>
  import('./pages/DocumentDetailsPage').then((mod) => ({ default: mod.DocumentDetailsPage })),
);
const CourseStudyPage = lazy(() =>
  import('./pages/CourseStudyPage').then((mod) => ({ default: mod.CourseStudyPage })),
);
const SharedContentPage = lazy(() =>
  import('./pages/SharedContentPage').then((mod) => ({ default: mod.SharedContentPage })),
);

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
                    <Route path="reinforcement-center" element={<ReinforcementCenterPage />} />
                    <Route path="feedback" element={<FeedbackPage />} />
                    <Route path="search" element={<SearchResultsPage />} />
                    <Route path="groups" element={<StudyGroupsPage />} />
                    <Route path="chat" element={<ChatListPage />} />
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
            </BrowserRouter>
          </TtsProvider>
        </PromptProvider>
      </StudyProvider>
    </AuthProvider>
  );
}
