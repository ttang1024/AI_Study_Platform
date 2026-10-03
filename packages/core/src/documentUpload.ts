// Accepted document upload formats — keep in sync with the backend allowlist
// in DocumentsController.Crud.cs (UploadDocument). Shared by web (file input
// accept attr) and rn (expo-document-picker MIME types); web wraps the
// File-typed helper around isAcceptedDocumentFile in its constants shim.
//
// Everything listed here must have a route through DocumentTextExtractorService:
// a dedicated extractor, or the raw-UTF-8 fallback for text-shaped formats.

export const DOCUMENT_ACCEPTED_EXTENSIONS = [
  // PDF & word processing
  '.pdf', '.docx', '.doc', '.docm', '.dotx', '.dotm', '.dot', '.rtf', '.abw',
  '.txt', '.md', '.markdown', '.mdx', '.mdown', '.mkd', '.qmd', '.rmd',
  // Presentations
  '.ppt', '.pptx', '.pptm', '.potx', '.potm', '.pps', '.ppsx', '.ppsm', '.pot',
  // Spreadsheets
  '.xls', '.xlsx', '.xlsm', '.xlt', '.xltx', '.xltm',
  // OpenDocument / StarOffice (zipped and flat XML)
  '.odt', '.odp', '.ods', '.odg', '.ott', '.otp', '.ots', '.otg',
  '.fodt', '.fodp', '.fods', '.sxw', '.sxi', '.sxc',
  // eBooks
  '.epub', '.mobi', '.azw', '.azw3', '.prc', '.pdb', '.fb2',
  // Apple iWork
  '.pages', '.key', '.numbers',
  // Fixed-layout & diagrams
  '.xps', '.oxps', '.vsdx',
  // Email
  '.eml', '.mhtml', '.mht', '.msg',
  // Markup & prose
  '.html', '.htm', '.xhtml', '.tex', '.ltx', '.sty', '.cls', '.bib', '.bbl',
  '.rst', '.adoc', '.asciidoc', '.org', '.textile', '.wiki', '.mediawiki',
  '.log', '.nfo', '.ini', '.toml', '.cfg', '.conf', '.properties',
  // Data & notebooks
  '.csv', '.tsv', '.json', '.jsonl', '.ndjson', '.json5', '.jsonc',
  '.xml', '.yaml', '.yml', '.plist', '.opml', '.rss', '.atom', '.ipynb',
  // Subtitles & captions
  '.srt', '.vtt', '.ass', '.ssa', '.sub', '.smi', '.sbv', '.lrc', '.ttml', '.dfxp',
  // Source code (treated as plain text)
  '.py', '.pyi', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts',
  '.vue', '.svelte', '.astro', '.coffee',
  '.java', '.kt', '.kts', '.scala', '.sbt', '.groovy', '.gradle',
  '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.m', '.mm',
  '.cs', '.vb', '.fs', '.fsx', '.go', '.rs', '.swift', '.dart',
  '.rb', '.rake', '.gemspec', '.php', '.phtml', '.pl', '.pm', '.lua', '.r', '.jl',
  '.sql', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.bat', '.cmd', '.awk',
  '.ex', '.exs', '.erl', '.hrl', '.hs', '.clj', '.cljs', '.cljc', '.edn',
  '.ml', '.mli', '.elm', '.rkt', '.scm', '.lisp', '.el', '.tcl', '.vim',
  '.nim', '.zig', '.d', '.pas', '.f90', '.f95', '.for', '.asm', '.s', '.ino',
  '.sol', '.tf', '.tfvars', '.hcl', '.proto', '.graphql', '.gql', '.avsc',
  '.cmake', '.mk', '.nix',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.erb', '.ejs', '.hbs', '.mustache', '.jinja', '.j2', '.twig', '.liquid',
  '.pug', '.haml', '.slim',
  // Images (AI OCR; SVG is read as XML text)
  '.png', '.jpg', '.jpeg', '.jfif', '.gif', '.webp', '.heic', '.heif',
  '.bmp', '.dib', '.svg',
];

export const DOCUMENT_ACCEPTED_MIME_TYPES = [
  'application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-word.template.macroEnabled.12',
  'application/x-abiword',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  'application/vnd.ms-powerpoint.template.macroEnabled.12',
  'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.template.macroEnabled.12',
  // OpenDocument / StarOffice
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.graphics',
  'application/vnd.oasis.opendocument.text-template',
  'application/vnd.oasis.opendocument.presentation-template',
  'application/vnd.oasis.opendocument.spreadsheet-template',
  'application/vnd.oasis.opendocument.graphics-template',
  'application/vnd.oasis.opendocument.text-flat-xml',
  'application/vnd.oasis.opendocument.presentation-flat-xml',
  'application/vnd.oasis.opendocument.spreadsheet-flat-xml',
  'application/vnd.sun.xml.writer', 'application/vnd.sun.xml.impress',
  'application/vnd.sun.xml.calc',
  // XPS / Visio
  'application/vnd.ms-xpsdocument', 'application/oxps',
  'application/vnd.ms-visio.drawing',
  // Email
  'message/rfc822', 'multipart/related', 'application/vnd.ms-outlook',
  // eBooks
  'application/epub+zip', 'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook', 'application/vnd.amazon.mobi8-ebook',
  'application/vnd.palm', 'application/x-fictionbook+xml',
  // Apple iWork
  'application/vnd.apple.pages', 'application/vnd.apple.keynote', 'application/vnd.apple.numbers',
  // Rich text / markup / data
  'application/rtf', 'text/rtf',
  'text/html', 'application/xhtml+xml',
  'text/csv', 'text/tab-separated-values',
  'application/json', 'application/x-ipynb+json',
  'application/x-ndjson', 'application/jsonl',
  'text/xml', 'application/xml', 'text/yaml', 'application/x-yaml',
  'application/x-plist', 'application/rss+xml', 'application/atom+xml',
  'application/x-tex', 'text/x-tex',
  // Subtitles / captions
  'application/x-subrip', 'text/vtt', 'application/ttml+xml',
  // Source code — only the types browsers actually report
  'text/css', 'text/javascript', 'application/javascript', 'application/x-sh',
  'text/x-python', 'text/x-c', 'text/x-c++src', 'text/x-java-source',
  'application/x-httpd-php', 'application/sql',
  // Images
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
  'image/webp', 'image/heic', 'image/heif', 'image/bmp', 'image/x-ms-bmp',
  'image/svg+xml',
];

export function isAcceptedDocumentFile(name: string, mimeType?: string | null): boolean {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  return (!!mimeType && DOCUMENT_ACCEPTED_MIME_TYPES.includes(mimeType)) || DOCUMENT_ACCEPTED_EXTENSIONS.includes(ext);
}
