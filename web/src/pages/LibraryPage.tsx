import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { LibraryBrowse } from './library/LibraryBrowse';

/**
 * Browsing what you already have. Adding new content is its own page (`/library/add`) rather than a
 * tab here — the two halves share nothing but the word "library", and one of them is a long form
 * that people arrive at from all over the app.
 */
export const LibraryPage: React.FC = () => (
  <div className="flex h-full flex-col gap-5">
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-text-main">
          Content <span className="text-primary">Library</span>
        </h1>
      </div>
      <Link
        to="/library/add"
        className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        <Plus size={15} />
        Add content
      </Link>
    </div>

    <LibraryBrowse />
  </div>
);

export default LibraryPage;
