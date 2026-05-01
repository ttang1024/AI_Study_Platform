import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Settings, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { Button } from '../components/common/Button';
import { cn } from '../utils/cn';
import { SearchFilterBar } from '../components/common/SearchFilterBar';
import { Pagination } from '../components/common/Pagination';
import { DocumentCard } from '../components/common/DocumentCard';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { opacity: 1, scale: 1, y: 0 }
};

export const DocumentsPage: React.FC = () => {
  const { documents, courses, deleteDocument, totalDocuments, courseMaterialCounts } = useStudy();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 6;

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseId === null || doc.courseId === selectedCourseId;
    return matchesSearch && matchesCourse;
  });

  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocs = filteredDocs.slice(startIndex, startIndex + itemsPerPage);

  const getCourse = (id?: string) => courses.find(c => c.id === id);

  const confirmDeleteDoc = documents.find(d => d.id === confirmDeleteId);

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId || !confirmDeleteDoc) return;
    setIsDeleting(true);
    try {
      await deleteDocument(confirmDeleteDoc.courseId || '', confirmDeleteId);
      // If current page becomes empty after deletion, go back one page
      const newFiltered = filteredDocs.filter(d => d.id !== confirmDeleteId);
      const newTotalPages = Math.ceil(newFiltered.length / itemsPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) setCurrentPage(newTotalPages);
    } finally {
      setIsDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Header Section */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
            <BookOpen size={22} />
          </div>
          <h1 className="text-3xl font-bold text-text-main">My Documents</h1>
          <span className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-sm">
            {totalDocuments} Total
          </span>
        </div>
      </motion.div>

      {/* Filters & Search */}
      <motion.div variants={item} className="w-full">
        <SearchFilterBar
          searchValue={searchQuery}
          onSearchChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          placeholder="Search by filename..."
          courses={courses}
          selectedCourseId={selectedCourseId}
          onCourseChange={(id) => { setSelectedCourseId(id); setCurrentPage(1); }}
          allCount={totalDocuments}
          courseCounts={Object.fromEntries(courses.map(c => [
            c.id,
            courseMaterialCounts.find(s => s.courseId === c.id)?.documents ?? 0,
          ]))}
        />
      </motion.div>

      {/* Documents Grid */}
      {paginatedDocs.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {paginatedDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                course={getCourse(doc.courseId)}
                onDelete={() => setConfirmDeleteId(doc.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-color)] py-20 text-center bg-[var(--bg-sidebar)]">
          <div className="mb-4 rounded-full bg-zinc-100 p-6 text-zinc-400">
            <BookOpen size={48} />
          </div>
          <h3 className="text-xl font-semibold text-text-main">No documents found</h3>
          <p className="text-text-muted max-w-xs mx-auto mt-2">
            We couldn't find any documents matching your current search or filter.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setSearchQuery('');
              setSelectedCourseId(null);
            }}
          >
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Pagination */}
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => !isDeleting && setConfirmDeleteId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Delete Document</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Are you sure you want to delete{' '}
                    <span className="font-semibold text-zinc-700 break-all">"{confirmDeleteDoc?.name}"</span>?
                    This action cannot be undone.
                  </p>
                </div>
                <div className="flex w-full gap-3 pt-2">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={isDeleting}
                    className="flex-1 rounded-2xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
