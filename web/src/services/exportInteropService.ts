// jszip is loaded on demand inside the export functions so the
// heavyweight library stays out of the page chunks until an export is run.

export interface ExportNoteRecord {
  title: string
  courseName?: string
  sourceType?: string
  createdAt?: string
  html: string
}

export interface ExportQuizQuestion {
  question: string
  options?: string[]
  correctAnswer: string
  explanation?: string
}

export interface ExportQuizRecord {
  title: string
  courseName?: string
  questions: ExportQuizQuestion[]
}

const sanitizeFileName = (value: string): string =>
  (value || 'study_export').replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'study_export'

const escapeCsv = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const stripHtml = (html: string): string => {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ')
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

const htmlToMarkdown = (html: string): string => {
  if (typeof document === 'undefined') return stripHtml(html)
  const div = document.createElement('div')
  div.innerHTML = html
  div.querySelectorAll('br').forEach(br => br.replaceWith('\n'))
  div.querySelectorAll('li').forEach(li => { li.textContent = `- ${li.textContent ?? ''}` })
  div.querySelectorAll('p,div,h1,h2,h3,li').forEach(el => el.append('\n'))
  return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadNotesMarkdown(notes: ExportNoteRecord[], name = 'notes'): void {
  const markdown = notes.map((note, index) => [
    `# ${note.title || `Note ${index + 1}`}`,
    note.courseName ? `Course: ${note.courseName}` : '',
    note.sourceType ? `Source: ${note.sourceType}` : '',
    note.createdAt ? `Created: ${new Date(note.createdAt).toLocaleDateString()}` : '',
    '',
    htmlToMarkdown(note.html),
  ].filter(Boolean).join('\n')).join('\n\n---\n\n')

  downloadBlob(
    new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    `${sanitizeFileName(name)}_notes.md`,
  )
}

export function downloadQuizCsv(quizzes: ExportQuizRecord[], name = 'quizzes'): void {
  const lines = [
    ['Source', 'Course', 'Question', 'Options', 'Correct Answer', 'Explanation'].map(escapeCsv).join(','),
    ...quizzes.flatMap(quiz => quiz.questions.map(q => [
      quiz.title,
      quiz.courseName ?? '',
      q.question,
      (q.options ?? []).join(' | '),
      q.correctAnswer,
      q.explanation ?? '',
    ].map(escapeCsv).join(','))),
  ]

  downloadBlob(
    new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }),
    `${sanitizeFileName(name)}_quiz_questions.csv`,
  )
}

export function downloadMoodleGift(quizzes: ExportQuizRecord[], name = 'quizzes'): void {
  const gift = quizzes.flatMap(quiz => quiz.questions.map(q => {
    const options = q.options?.length
      ? q.options.map(o => `${o === q.correctAnswer ? '=' : '~'}${o}`).join('\n')
      : `=${q.correctAnswer}`
    const explanation = q.explanation ? `\n#### ${q.explanation}` : ''
    return `// ${quiz.title}\n::${quiz.title}:: ${q.question} {\n${options}${explanation}\n}`
  })).join('\n\n')

  downloadBlob(
    new Blob([gift], { type: 'text/plain;charset=utf-8' }),
    `${sanitizeFileName(name)}_moodle_gift.txt`,
  )
}

export async function downloadQtiZip(quizzes: ExportQuizRecord[], name = 'quizzes'): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const identifier = sanitizeFileName(name)
  const items = quizzes.flatMap((quiz, quizIndex) => quiz.questions.map((q, questionIndex) => {
    const itemId = `item_${quizIndex + 1}_${questionIndex + 1}`
    const choices = q.options?.length ? q.options : [q.correctAnswer]
    const correctIndex = Math.max(0, choices.findIndex(choice => choice === q.correctAnswer))
    return `
      <item ident="${itemId}" title="${escapeXml(quiz.title)}">
        <presentation>
          <material><mattext texttype="text/plain">${escapeXml(q.question)}</mattext></material>
          <response_lid ident="response1" rcardinality="Single">
            <render_choice>
              ${choices.map((choice, i) => `<response_label ident="choice_${i}"><material><mattext texttype="text/plain">${escapeXml(choice)}</mattext></material></response_label>`).join('\n')}
            </render_choice>
          </response_lid>
        </presentation>
        <resprocessing>
          <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
          <respcondition continue="No">
            <conditionvar><varequal respident="response1">choice_${correctIndex}</varequal></conditionvar>
            <setvar action="Set" varname="SCORE">100</setvar>
          </respcondition>
        </resprocessing>
      </item>`
  })).join('\n')

  const qti = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <assessment ident="${identifier}" title="${escapeXml(name)}">
    <section ident="root_section">
      ${items}
    </section>
  </assessment>
</questestinterop>`

  zip.file('assessment.xml', qti)
  zip.file('imsmanifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
  <resources>
    <resource identifier="assessment_resource" type="imsqti_xmlv1p2" href="assessment.xml">
      <file href="assessment.xml"/>
    </resource>
  </resources>
</manifest>`)

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${identifier}_qti.zip`)
}
