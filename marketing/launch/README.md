# Launch and backlink kit

Google already indexes https://toto-study.com/ (Search Console, 2026-10-09). The reason searches for
"Toto Study" don't find it is that nothing else on the web links to it or names it yet. Each listing
below adds a link that says "Toto Study", which is how Google learns the two words are a brand.

Rules that matter more than the number of listings:

- **Use the exact name "Toto Study"** and the URL `https://toto-study.com` everywhere. Don't use
  "toto.ai", "TotoStudy app" or other variants.
- **Link a feature page when the listing is about one feature**, for example a flashcard directory
  should link `https://toto-study.com/ai-flashcard-generator/`.
- **After you create a profile, send me its URL.** I'll add it to `sameAs` in the Organization
  schema in `web/index.html`. Matching profiles are a strong brand signal.
- Don't buy links or use link farms. Google penalises the whole site for that.

## 1. Do first (high value, about an hour in total)

| Where | What to do |
| --- | --- |
| GitHub repo | Settings, then "About": set Website to `https://toto-study.com`, set the description to the short pitch below, and add topics: `ai`, `flashcards`, `spaced-repetition`, `fsrs`, `study`, `education`, `quiz-generator` |
| Product Hunt | Launch on a Tuesday to Thursday, 12:01am Pacific time. Use the long pitch and the images in `marketing/social/` |
| Hacker News | "Show HN: Toto Study, open source AI study platform with FSRS spaced repetition" linking the GitHub repo. Be ready to answer comments for a few hours |
| Reddit | Share it as something you built, not as an advert, in r/SideProject, r/opensource and r/selfhosted (self-host angle). Read each sub's rules first; r/GetStudying and r/Anki are strict about self-promotion |
| X / LinkedIn / Bluesky | Create a "Toto Study" profile with the site in the bio, then post one launch thread |

## 2. AI tool directories (each one is a lasting link)

Submit the short pitch and the homepage URL to: There's An AI For That (theresanaiforthat.com),
Futurepedia, Toolify, AI Tools Directory (aitoolsdirectory.com), TopAI.tools, SaaSHub, AlternativeTo
(list it as an alternative to Quizlet, Anki and NotebookLM), and Uneed. Several are free with a
waiting list; skip paid "featured" listings at first.

## 3. Ongoing

- Write a short blog post or dev.to article about a real problem you solved (for example "How FSRS
  schedules flashcards" or "Building SSE streaming AI in .NET"), linking a feature page.
- Answer study questions on Reddit or Quora where Toto Study genuinely helps, and say that you
  built it.
- Check Search Console, then Performance, every week or two. Watch which queries start getting
  impressions and tell me, and I can add or adjust feature pages for them.

## Copy to paste

**Name:** Toto Study

**Tagline (60 characters):** AI flashcards, quizzes and summaries from anything you study

**Short pitch (about 160 characters):**
Toto Study turns PDFs, slides, YouTube videos, podcasts and articles into AI summaries, flashcards,
quizzes and mind maps, then schedules review with FSRS.

**Long pitch:**
Toto Study is a free-to-start, open source AI study platform. Add a document in any of 240+ formats,
a YouTube or other video link, a podcast episode or a web article, and it writes summaries, mind
maps, flashcards, practice quizzes, glossaries and worked problems from your own material. An FSRS
spaced repetition scheduler then brings each card back just before you would forget it, with timed
mock exams, a mistakes notebook and an AI tutor for exam prep. It works on the web, iOS and Android,
including offline review. You bring your own AI provider key, which travels with each request and is
never stored on the server.

**Categories:** Education, Productivity, Artificial Intelligence, Open Source

**Links:**
- Home: https://toto-study.com/
- AI flashcard generator: https://toto-study.com/ai-flashcard-generator/
- AI quiz generator: https://toto-study.com/ai-quiz-generator/
- AI PDF summary: https://toto-study.com/ai-pdf-summary/
- YouTube video summary: https://toto-study.com/ai-youtube-summary/
- Spaced repetition app: https://toto-study.com/spaced-repetition-app/
- AI mind map generator: https://toto-study.com/ai-mind-map-generator/
- Source code: https://github.com/ttang1024/AI_Study_Platform
