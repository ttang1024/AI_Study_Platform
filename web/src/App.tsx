import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudyProvider } from './context/StudyContext';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { DocumentDetailsPage } from './pages/DocumentDetailsPage';
import { QuizManagementPage } from './pages/QuizManagementPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { NotesPage } from './pages/NotesPage';
import { SettingsPage } from './pages/SettingsPage';
import { YouTubeDetailPage } from './pages/YouTubeDetailPage';
import { AISummarizerPage } from './pages/AISummarizerPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { LandingPage } from './pages/LandingPage';
import { GlossaryPage } from './pages/GlossaryPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { ArticlePage } from './pages/ArticlePage';
import { AudioDetailPage } from './pages/AudioDetailPage';
import { CourseStudyPage } from './pages/CourseStudyPage';
import { SharedContentPage } from './pages/SharedContentPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { StudyGroupsPage } from './pages/StudyGroupsPage';
import { StudyGroupDetailPage } from './pages/StudyGroupDetailPage';
import { ChatListPage } from './pages/ChatListPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};


export default function App() {
  return (
    <AuthProvider>
      <StudyProvider>
        <BrowserRouter>
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
              <Route path="youtube" element={<Navigate to="/library?type=videos" replace />} />
              <Route path="summarizer" element={<AISummarizerPage />} />
              <Route path="flashcards" element={<FlashcardsPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="quizzes" element={<QuizManagementPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="glossary" element={<GlossaryPage />} />
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
            <Route path="/youtube/:id" element={
              <ProtectedRoute>
                <YouTubeDetailPage />
              </ProtectedRoute>
            } />
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
        </BrowserRouter>
      </StudyProvider>
    </AuthProvider>
  );
}
