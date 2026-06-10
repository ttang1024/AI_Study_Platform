// jszip and jspdf are loaded on demand inside the export functions so these
// heavyweight libraries stay out of the page chunks until an export is run.

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

export interface ExportFlashcardRecord {
  front: string
  back: string
  sourceTitle?: string
}

export interface ExportGlossaryRecord {
  term: string
  definition: string
  sourceName?: string
}

export interface StudyPackExport {
  notes?: ExportNoteRecord[]
  quizzes?: ExportQuizRecord[]
  flashcards?: ExportFlashcardRecord[]
  glossary?: ExportGlossaryRecord[]
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

export async function downloadStudyPackPdf(pack: StudyPackExport, name = 'study_pack'): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 14
  let y = 18

  const addLine = (text: string, size = 10, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const lines = pdf.splitTextToSize(text, pageWidth - margin * 2)
    for (const line of lines) {
      if (y > 280) {
        pdf.addPage()
        y = 18
      }
      pdf.text(line, margin, y)
      y += size * 0.45 + 3
    }
  }

  addLine(name, 18, true)
  addLine(`Generated ${new Date().toLocaleString()}`, 9)
  y += 4

  if (pack.notes?.length) {
    addLine('Notes', 14, true)
    pack.notes.forEach(note => {
      addLine(note.title, 11, true)
      addLine(stripHtml(note.html))
      y += 2
    })
  }

  if (pack.quizzes?.length) {
    addLine('Quizzes', 14, true)
    pack.quizzes.forEach(quiz => {
      addLine(quiz.title, 11, true)
      quiz.questions.forEach((q, i) => {
        addLine(`${i + 1}. ${q.question}`)
        addLine(`Answer: ${q.correctAnswer}`, 9)
      })
      y += 2
    })
  }

  if (pack.flashcards?.length) {
    addLine('Flashcards', 14, true)
    pack.flashcards.forEach(card => {
      addLine(`Front: ${card.front}`)
      addLine(`Back: ${card.back}`, 9)
    })
  }

  if (pack.glossary?.length) {
    addLine('Glossary', 14, true)
    pack.glossary.forEach(term => addLine(`${term.term}: ${term.definition}`))
  }

  pdf.save(`${sanitizeFileName(name)}.pdf`)
}

export async function downloadObsidianVault(pack: StudyPackExport, name = 'study_vault'): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const root = zip.folder(sanitizeFileName(name))!

  root.file('README.md', `# ${name}\n\nExported from Study Platform on ${new Date().toLocaleString()}.\n`)

  const notesFolder = root.folder('Notes')!
  pack.notes?.forEach((note, index) => {
    notesFolder.file(`${sanitizeFileName(note.title || `note_${index + 1}`)}.md`, [
      '---',
      `title: ${note.title}`,
      note.courseName ? `course: ${note.courseName}` : '',
      note.sourceType ? `source_type: ${note.sourceType}` : '',
      note.createdAt ? `created: ${note.createdAt}` : '',
      '---',
      '',
      htmlToMarkdown(note.html),
    ].filter(Boolean).join('\n'))
  })

  const quizFolder = root.folder('Quizzes')!
  pack.quizzes?.forEach((quiz, index) => {
    quizFolder.file(`${sanitizeFileName(quiz.title || `quiz_${index + 1}`)}.md`, [
      `# ${quiz.title}`,
      '',
      ...quiz.questions.flatMap((q, i) => [
        `## Question ${i + 1}`,
        q.question,
        '',
        ...(q.options ?? []).map(option => `- ${option}`),
        '',
        `**Answer:** ${q.correctAnswer}`,
        q.explanation ? `**Explanation:** ${q.explanation}` : '',
        '',
      ]),
    ].join('\n'))
  })

  if (pack.flashcards?.length) {
    root.file('Flashcards.md', pack.flashcards.map(card => [
      `## ${card.front}`,
      card.sourceTitle ? `Source: [[${card.sourceTitle}]]` : '',
      '',
      card.back,
    ].filter(Boolean).join('\n')).join('\n\n'))
  }

  if (pack.glossary?.length) {
    root.file('Glossary.md', pack.glossary.map(term => `## ${term.term}\n\n${term.definition}`).join('\n\n'))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${sanitizeFileName(name)}_obsidian.zip`)
}
