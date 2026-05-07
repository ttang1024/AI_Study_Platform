import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Loader2 } from 'lucide-react';
import { DocumentCard } from '../common/DocumentCard';
import { useStudy } from '../../context/StudyContext';
import { apiClient } from '../../services/apiClient';
import { DuplicateAlert } from './DuplicateAlert';

export interface WebTabProps {
  selectedCourseId: string;
  onCourseError: (v: boolean) => void;
}

export const WebTab: React.FC<WebTabProps> = ({ selectedCourseId, onCourseError }) => {
  const navigate = useNavigate();
  const { documents, courses, refreshDocuments, refreshStats } = useStudy();
  const [webUrl, setWebUrl] = useState('');
  const [clippingUrl, setClippingUrl] = useState(false);
  const [clipError, setClipError] = useState('');

  useEffect(() => { refreshDocuments(); }, []);

  const recentArticles = documents.filter(d => d.originalUrl && d.type !== 'audio' && d.type !== 'podcast').slice(0, 3);
  const getCourse = (id?: string) => courses.find(c => c.id === id);

  const dupArticle = webUrl.trim()
    ? documents.find(d => d.originalUrl === webUrl.trim()) ?? null
    : null;
  const dupArticleCourse = dupArticle?.courseId ? courses.find(c => c.id === dupArticle.courseId) : undefined;

  const handleClipUrl = async () => {
    if (!webUrl) return;
    if (!selectedCourseId) { onCourseError(true); return; }
    onCourseError(false);
    setClippingUrl(true);
    setClipError('');
    try {
      const res = await apiClient.post('/api/documents/clip-url', { url: webUrl, courseId: selectedCourseId });
      setWebUrl('');
      await Promise.all([refreshDocuments(), refreshStats()]);
      navigate(`/articles/${res.data.data.documentId}`, { state: { courseId: res.data.data.courseId } });
    } catch (e: any) {
      setClipError(e?.response?.data?.message ?? 'Failed to clip article. Please try again.');
    } finally {
      setClippingUrl(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Paste any web article URL to extract and analyze its content.</p>
      <div className="flex gap-3">
        <input
          type="url"
          placeholder="https://example.com/article"
          value={webUrl}
          onChange={e => setWebUrl(e.target.value)}
          className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={handleClipUrl}
          disabled={!webUrl || clippingUrl}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {clippingUrl ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
          {clippingUrl ? 'Clipping...' : 'Clip Article'}
        </button>
      </div>
      <AnimatePresence>
        {dupArticle && dupArticleCourse && (
          <DuplicateAlert
            label="article"
            courseName={dupArticleCourse.name}
            to={`/articles/${dupArticle.id}`}
          />
        )}
      </AnimatePresence>
      {clipError && <p className="text-sm text-red-500">{clipError}</p>}
      {recentArticles.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-text-main">Recent Articles</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentArticles.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                course={getCourse(doc.courseId)}
                to={`/articles/${doc.id}`}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
