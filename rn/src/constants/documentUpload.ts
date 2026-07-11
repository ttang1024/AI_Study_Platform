// Ported from web/src/constants/documentUpload.ts — accepted document upload
// formats, kept in sync with the backend allowlist in DocumentsController.Crud.cs
// (UploadDocument). The web `accept` attribute string and `File`-typed helper
// don't apply on RN — `expo-document-picker` takes MIME types directly.

export const DOCUMENT_ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.docm', '.dotx', '.txt', '.md', '.markdown',
  '.ppt', '.pptx', '.pptm', '.potx',
  '.xls', '.xlsx', '.xlsm',
  '.odt', '.odp', '.ods',
  '.epub', '.mobi', '.fb2',
  '.pages', '.key', '.numbers',
  '.xps', '.oxps', '.vsdx',
  '.eml', '.mhtml', '.mht', '.msg',
  '.rtf', '.html', '.htm', '.xhtml', '.tex',
  '.rst', '.adoc', '.org', '.log', '.ini', '.toml', '.cfg',
  '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml', '.ipynb',
  '.srt', '.vtt', '.ass', '.ssa', '.sub', '.smi',
  // Source code (treated as plain text)
  '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.c', '.h', '.cpp', '.hpp',
  '.cs', '.rb', '.go', '.rs', '.swift', '.kt', '.php', '.sql', '.sh', '.r',
  '.scala', '.lua', '.pl', '.m',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.bmp', '.svg',
];

export const DOCUMENT_ACCEPTED_MIME_TYPES = [
  'application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-word.template.macroEnabled.12',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/vnd.ms-xpsdocument', 'application/oxps',
  'application/vnd.ms-visio.drawing',
  'message/rfc822', 'multipart/related', 'application/vnd.ms-outlook',
  'application/epub+zip', 'application/x-mobipocket-ebook',
  'application/x-fictionbook+xml',
  'application/vnd.apple.pages', 'application/vnd.apple.keynote', 'application/vnd.apple.numbers',
  'application/rtf', 'text/rtf',
  'text/html', 'application/xhtml+xml',
  'text/csv', 'text/tab-separated-values',
  'application/json', 'application/x-ipynb+json',
  'text/xml', 'application/xml', 'text/yaml', 'application/x-yaml',
  'application/x-tex', 'text/x-tex',
  'application/x-subrip', 'text/vtt',
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
  'image/webp', 'image/heic', 'image/heif', 'image/bmp',
  'image/svg+xml',
];

export function isAcceptedDocumentFile(name: string, mimeType?: string | null): boolean {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  return (!!mimeType && DOCUMENT_ACCEPTED_MIME_TYPES.includes(mimeType)) || DOCUMENT_ACCEPTED_EXTENSIONS.includes(ext);
}
