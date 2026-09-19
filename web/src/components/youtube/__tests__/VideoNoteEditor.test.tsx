import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { VideoNoteEditor, VideoNoteEditorRef } from '../VideoNoteEditor';

describe('VideoNoteEditor', () => {
  it('renders a note that arrives after it mounted', async () => {
    // The detail pages fetch the saved note after this editor is already on screen,
    // so its first render is handed an empty string — the note has to land later.
    const { rerender } = render(<VideoNoteEditor videoRecordId="doc-note-1" initialContent="" />);

    rerender(<VideoNoteEditor videoRecordId="doc-note-1" initialContent="<p>Saved note</p>" />);

    await waitFor(() => expect(screen.getByText('Saved note')).toBeInTheDocument());
  });

  it('does not overwrite content already in the editor', async () => {
    const ref = { current: null } as React.RefObject<VideoNoteEditorRef | null>;
    const { rerender } = render(
      <VideoNoteEditor ref={ref} videoRecordId="doc-note-1" initialContent="" />
    );
    await act(async () => { ref.current?.appendContent('<p>typed by hand</p>'); });
    expect(screen.getByText('typed by hand')).toBeInTheDocument();

    rerender(<VideoNoteEditor ref={ref} videoRecordId="doc-note-1" initialContent="<p>Saved note</p>" />);

    expect(screen.getByText('typed by hand')).toBeInTheDocument();
    expect(screen.queryByText('Saved note')).not.toBeInTheDocument();
  });

  it('reloads when the record changes', async () => {
    const { rerender } = render(<VideoNoteEditor videoRecordId="doc-note-1" initialContent="<p>First</p>" />);
    await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument());

    rerender(<VideoNoteEditor videoRecordId="doc-note-2" initialContent="<p>Second</p>" />);

    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());
    expect(screen.queryByText('First')).not.toBeInTheDocument();
  });
});
