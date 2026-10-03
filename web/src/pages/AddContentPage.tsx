import React from 'react';
import { AddContentForm } from './library/AddContentForm';

/**
 * Adding new material — the old AI Summarizer, and until now the Add tab of `/library`.
 *
 * No page header of its own, unlike the rest of the app: the form owns the heading, so the course
 * rail and the input-mode tabs both start at the top of the page. It lays itself out against the
 * available height (a fixed rail beside a scrolling column) rather than growing with its content,
 * hence the definite height here instead of a guess in `vh`.
 */
export const AddContentPage: React.FC = () => (
  <div className="h-full min-h-[520px]">
    <AddContentForm />
  </div>
);

export default AddContentPage;
