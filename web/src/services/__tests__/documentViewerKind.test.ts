import { describe, it, expect } from 'vitest';
import { getDocumentViewerKind, usesServerExtractedText } from '@core/services/documentService';

const doc = (name: string, type = 'txt') => ({ name, type });

describe('getDocumentViewerKind', () => {
  it('keeps the existing pdf / docx / image renderers', () => {
    expect(getDocumentViewerKind(doc('a.pdf', 'pdf'))).toBe('pdf');
    expect(getDocumentViewerKind(doc('a.docx', 'docx'))).toBe('docx');
    expect(getDocumentViewerKind(doc('scan.png', 'image'))).toBe('image');
  });

  it('routes source files to the code viewer', () => {
    for (const name of ['main.py', 'App.tsx', 'query.sql', 'style.scss', 'paper.tex'])
      expect(getDocumentViewerKind(doc(name))).toBe('code');
  });

  it('separates structured data from source code', () => {
    for (const name of ['config.yaml', 'data.json', 'feed.rss', 'settings.toml'])
      expect(getDocumentViewerKind(doc(name))).toBe('data');
  });

  it('routes csv/tsv to the table viewer', () => {
    expect(getDocumentViewerKind(doc('grades.csv'))).toBe('table');
    expect(getDocumentViewerKind(doc('grades.TSV'))).toBe('table');
  });

  it('routes notebooks, captions and html to their own viewers', () => {
    expect(getDocumentViewerKind(doc('lab.ipynb'))).toBe('notebook');
    expect(getDocumentViewerKind(doc('talk.vtt'))).toBe('subtitle');
    expect(getDocumentViewerKind(doc('captions.ttml'))).toBe('subtitle');
    expect(getDocumentViewerKind(doc('page.html'))).toBe('html');
  });

  it('treats the whole markdown family as markdown', () => {
    for (const name of ['notes.md', 'notes.mdx', 'report.qmd', 'analysis.rmd'])
      expect(getDocumentViewerKind(doc(name))).toBe('md');
  });

  it('falls back to plain text for prose and unknown extensions', () => {
    expect(getDocumentViewerKind(doc('notes.txt'))).toBe('text');
    expect(getDocumentViewerKind(doc('notes.rst'))).toBe('text');
    expect(getDocumentViewerKind(doc('mystery.qqq'))).toBe('text');
  });

  it('shows extracted text for binary formats, whatever their extension suggests', () => {
    for (const name of ['book.epub', 'deck.pptx', 'sheet.xlsx', 'old.dot', 'mail.eml'])
      expect(getDocumentViewerKind(doc(name))).toBe('text');
  });
});

describe('usesServerExtractedText', () => {
  it('no longer intercepts the formats that now render client-side', () => {
    for (const name of ['lab.ipynb', 'page.html', 'captions.ttml', 'captions.dfxp'])
      expect(usesServerExtractedText(doc(name))).toBe(false);
  });

  it('still intercepts binary containers', () => {
    expect(usesServerExtractedText(doc('book.azw3'))).toBe(true);
    expect(usesServerExtractedText(doc('notes.fodt'))).toBe(true);
  });
});
