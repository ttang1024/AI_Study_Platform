/**
 * Public, crawlable feature pages: one per search intent ("AI flashcard generator", "YouTube video
 * summary", ...). The homepage is the only other public page with real content, and one page can
 * only rank for so many queries, so these exist to give search engines something specific to match.
 *
 * Single source for two consumers that must agree:
 *  - web/src/pages/FeaturePage.tsx renders them in the SPA;
 *  - web/vite-plugin-seo.ts writes a static dist/<slug>/index.html for each (own title, meta,
 *    canonical, JSON-LD and <noscript> copy) and lists them in sitemap.xml.
 *
 * Plain data only: vite.config.ts imports this file, so it must not pull in React or the app.
 *
 * URLs end in a slash ("/ai-flashcard-generator/") because the web bucket is an S3 website
 * endpoint, which serves <slug>/index.html for "/<slug>/" and 302s "/<slug>" onto it. The canonical
 * link, sitemap entry and every internal link use the slashed form so nothing indexes the redirect.
 *
 * A slug must not start with any robots.txt Disallow prefix (see vite-plugin-seo.ts), or the page
 * is blocked from crawling. featurePages.test.ts checks that, and that this list and
 * FEATURE_PAGE_SLUGS (the route list App.tsx reads) hold the same slugs.
 */

import type { FeaturePageSlug } from './featurePageSlugs'

export type FeaturePageSection = {
	heading: string
	body: string
	/** A real generated snippet backing the claim, shown under the body and in <noscript>. */
	example?: {
		/** "Flashcard", "Key concept", ... or a chapter timestamp. */
		label: string
		text: string
		/** YouTube id of the source video, for its thumbnail. */
		videoId?: string
	}
}
export type FeaturePageFaq = { question: string; answer: string }
/** A real generated result, linked to its public share. The excerpt is the AI output verbatim. */
export type FeaturePageExample = {
	title: string
	/** Where the source came from, e.g. "YouTube · 26:49 summarised". */
	source: string
	sourceUrl: string
	/** YouTube id, for the embedded player. */
	videoId: string
	sharePath: string
	excerpt: string
	includes: string[]
}

export type FeaturePageContent = {
	slug: FeaturePageSlug
	/** <title>. Keep it under about 60 characters so search results show it whole. */
	title: string
	/** Meta description: the snippet under the result. About 150 to 160 characters. */
	description: string
	/** Short label for cross-links between the pages and the homepage footer. */
	navLabel: string
	h1: string
	intro: string
	steps: string[]
	sections: FeaturePageSection[]
	faqs: FeaturePageFaq[]
	/** Real outputs, shown under the steps and listed in the <noscript> copy. */
	examples?: FeaturePageExample[]
}

export const FEATURE_PAGES: FeaturePageContent[] = [
	{
		slug: 'ai-flashcard-generator',
		title: 'AI Flashcard Generator from PDFs, Notes and Videos | Toto Study',
		description:
			'Turn PDFs, lecture slides, notes and YouTube videos into flashcards in seconds with AI, then review them with FSRS spaced repetition. Free to start.',
		navLabel: 'AI flashcard generator',
		h1: 'AI flashcard generator for PDFs, notes and videos',
		intro:
			'Stop typing flashcards by hand. Upload a PDF, a Word document, lecture slides or a video link and Toto Study writes question and answer flashcards from the material itself, ready to review straight away.',
		steps: [
			'Add your study material: a document in any of 240+ formats, a video or podcast link, or a web article.',
			'Ask for flashcards. The AI picks out the key facts, definitions and concepts and writes a card for each one.',
			'Edit anything you like, then study. The FSRS spaced repetition scheduler decides when each card comes back.',
		],
		sections: [
			{
				heading: 'Flashcards made from your own material',
				body: 'Cards come from the document or transcript you added, not from a generic question bank, so they match what your course actually covers. Each set stays linked to its source, which makes it easy to go back and check the context.',
			},
			{
				heading: 'Spaced repetition built in',
				body: 'Every card is scheduled with FSRS, a modern spaced repetition algorithm. Rate each card Again, Hard, Good or Easy and the next review lands just before you would forget it, so you spend time on the cards you need and less on the ones you know.',
			},
			{
				heading: 'Works with almost any source',
				body: 'PDF, Word, PowerPoint, Excel, EPUB, Markdown, scanned images with OCR, YouTube and other video sites, podcast episodes and web articles all work. If you can read it or watch it, you can make flashcards from it.',
			},
			{
				heading: 'Study on the web, iOS and Android',
				body: 'Your decks sync between the web app and the mobile apps, and flashcards are cached for offline review, so a bus ride or a gap between lectures is enough for a quick session.',
			},
		],
		faqs: [
			{
				question: 'Is the AI flashcard generator free?',
				answer: 'Toto Study is free to start. You connect your own AI provider key, which is sent with each request and never stored on our servers.',
			},
			{
				question: 'Can I make flashcards from a PDF?',
				answer: 'Yes. Upload the PDF and ask for flashcards. Text-based PDFs work directly and scanned pages are read with OCR.',
			},
			{
				question: 'Can I edit the generated flashcards?',
				answer: 'Yes. Every card can be edited, deleted or added to before and after you start studying.',
			},
		],
	},
	{
		slug: 'ai-quiz-generator',
		title: 'AI Quiz Generator: Practice Quizzes from Any PDF or Video',
		description:
			'Make practice quizzes from your PDFs, slides, notes and videos with AI. Multiple choice questions, instant feedback, timed mock exams and a mistakes notebook.',
		navLabel: 'AI quiz generator',
		h1: 'AI quiz generator for your study material',
		intro:
			'Testing yourself is one of the most reliable ways to remember what you study. Toto Study turns your documents and videos into practice quizzes so you can find the gaps before the exam does.',
		steps: [
			'Add a document, a set of lecture slides, a video or an article.',
			'Generate a quiz. The AI writes questions with answer options and an explanation for each one.',
			'Take the quiz, review what you got wrong, and come back to those questions later.',
		],
		sections: [
			{
				heading: 'Questions from your own content',
				body: 'Quizzes are written from the material you added, so the questions cover your syllabus rather than general trivia. Each question comes with an explanation, so a wrong answer still teaches you something.',
			},
			{
				heading: 'Mock exams with a timer',
				body: 'When an exam is coming up, run a timed mock exam across your material to practise under real conditions and see where you stand.',
			},
			{
				heading: 'A notebook for your mistakes',
				body: 'Questions you get wrong are collected in one place, so revision can focus on what you have not mastered yet instead of going over everything again.',
			},
		],
		faqs: [
			{
				question: 'What can I make a quiz from?',
				answer: 'PDFs, Word documents, PowerPoint slides, spreadsheets, EPUB books, plain text, web articles, YouTube and other video links, and podcast episodes.',
			},
			{
				question: 'Do the quizzes include explanations?',
				answer: 'Yes. Each question has an explanation of the correct answer.',
			},
			{
				question: 'Is it free to use?',
				answer: 'Toto Study is free to start. You bring your own AI provider key, which is never stored on our servers.',
			},
		],
	},
	{
		slug: 'ai-pdf-summary',
		title: 'AI PDF Summary: Summarise PDFs, Word Docs and Slides',
		description:
			'Upload a PDF, Word document or slide deck and get a clear AI summary in seconds, plus a mind map, flashcards and a quiz from the same file. Free to start.',
		navLabel: 'AI PDF summary',
		h1: 'Summarise any PDF with AI',
		intro:
			'Long readings, dense papers and 80-slide lecture decks take hours to get through. Upload the file and Toto Study gives you a structured summary of the main ideas, so you know what matters before you dive into the detail.',
		steps: [
			'Upload a PDF, Word document, PowerPoint deck or one of 240+ other formats.',
			'Get a summary organised by topic, with the key points pulled out.',
			'Keep going from the same file: ask questions about it, or turn it into a mind map, flashcards or a quiz.',
		],
		sections: [
			{
				heading: 'Summaries that keep the structure',
				body: 'The summary follows the shape of the document, with headings and key points, so it reads like good study notes rather than a single block of text.',
			},
			{
				heading: 'Ask the document questions',
				body: 'Chat with the AI about the file you uploaded to clear up a confusing section, get an example, or check your understanding in your own words.',
			},
			{
				heading: 'Scanned pages and images too',
				body: 'Scanned PDFs and photos of pages are read with OCR, so handouts and textbook photos can be summarised as well as digital files.',
			},
		],
		faqs: [
			{
				question: 'Which file types can be summarised?',
				answer: 'PDF, Word, PowerPoint, Excel, EPUB, Markdown, plain text, source code, notebooks, subtitle files and images with OCR, over 240 formats in total.',
			},
			{
				question: 'Can it summarise a scanned PDF?',
				answer: 'Yes. Scanned pages are read with OCR before they are summarised.',
			},
			{
				question: 'Is my document kept private?',
				answer: 'Your library is private to your account. Nothing is shared unless you create a share link yourself.',
			},
		],
	},
	{
		slug: 'ai-youtube-summary',
		title: 'YouTube Video Summary, Notes and Flashcards with AI',
		description:
			'Paste a YouTube, Vimeo, TED or Bilibili link and get an AI summary, study notes, flashcards and a quiz from the transcript. Great for lectures and tutorials.',
		navLabel: 'YouTube video summary',
		h1: 'Turn YouTube videos into summaries and flashcards',
		intro:
			'A long lecture is hard to revise from. Paste the link and Toto Study pulls the transcript and writes a timestamped summary, flashcards and a quiz you can actually review. The demo here is real output from a 3Blue1Brown lecture on transformers.',
		steps: [
			'Paste a link from YouTube, Bilibili, Vimeo, TED, TikTok or another supported video site.',
			'Toto Study fetches the transcript, or transcribes the audio when no captions exist.',
			'Read the summary, then generate flashcards, a quiz or a mind map from the video.',
		],
		sections: [
			{
				heading: 'Jump straight to the part you need',
				body: 'The summary splits the video into timestamped chapters, each with a short recap. Read the whole lecture in a few minutes, then go back and watch the parts you want to understand properly.',
				example: {
					label: '4:07',
					text: 'The Model Context Protocol (MCP) serves as an open standard that connects the agent (acting as the MCP host) to external systems (acting as MCP servers).',
					videoId: 'X4FVEEegCbk',
				},
			},
			{
				heading: 'Key ideas explained, not just listed',
				body: 'Every summary ends with the key concepts in plain language and a short list of takeaways, so the terms you will be tested on are already defined for you.',
				example: {
					label: 'Key concept',
					text: "Prompt Injection: A vulnerability where an attacker manipulates an LLM's behavior by crafting malicious inputs (prompts) that bypass its intended safeguards or cause it to execute unintended commands.",
					videoId: 'cYuesqIKf9A',
				},
			},
			{
				heading: 'From watching to remembering',
				body: 'Watching a video once is easy to forget. Flashcards and quiz questions written from the transcript, reviewed with spaced repetition, help the content stick.',
				example: {
					label: 'Flashcard',
					text: 'How many parameters does the GPT-3 model contain? 175 billion.',
					videoId: 'wjZofJX0v4M',
				},
			},
		],
		faqs: [
			{
				question: 'Which video sites are supported?',
				answer: 'YouTube, Bilibili, Vimeo, TED, TikTok and several other video sites.',
			},
			{
				question: 'What if the video has no captions?',
				answer: 'Toto Study falls back to transcribing the audio, so videos without captions still work.',
			},
			{
				question: 'Can I make flashcards from a YouTube video?',
				answer: 'Yes. Once the transcript is in, you can generate flashcards, a quiz, a mind map or a glossary from it.',
			},
			{
				question: 'What does a video summary include?',
				answer: 'A short overview, a timeline that splits the video into timestamped chapters with a summary of each, the key concepts explained in a paragraph or two, and a list of key takeaways.',
			},
		],
		examples: [
			{
				title: 'Transformers, the tech behind LLMs | Deep Learning Chapter 5',
				source: '3Blue1Brown on YouTube · 26:49 summarised',
				sourceUrl: 'https://www.youtube.com/watch?v=wjZofJX0v4M',
				videoId: 'wjZofJX0v4M',
				sharePath: '/share/9lowyLRmOJq6',
				excerpt:
					'Generative Pretrained Transformers (GPT) operate by converting textual inputs into high-dimensional numerical vectors, processing these vectors through successive layers of mathematical transformations, and generating a probability distribution to predict the subsequent word in a sequence.',
				includes: ['5-chapter timeline', 'Key concepts', 'Mind map', '6 flashcards', '4 quiz questions'],
			},
			{
				title: 'Explained: The OWASP Top 10 for Large Language Model Applications',
				source: 'YouTube · 14:14 summarised',
				sourceUrl: 'https://www.youtube.com/watch?v=cYuesqIKf9A',
				videoId: 'cYuesqIKf9A',
				sharePath: '/share/_5Z-MkOcMHnu',
				excerpt:
					'Large Language Models (LLMs) and chatbots have experienced unprecedented rapid adoption, demonstrating capabilities like advanced language translation, but this widespread use introduces significant security vulnerabilities.',
				includes: ['5-chapter timeline', 'Key concepts', 'Key takeaways', 'Mind map'],
			},
		],
	},
	{
		slug: 'spaced-repetition-app',
		title: 'FSRS Spaced Repetition App with AI Flashcards | Toto Study',
		description:
			'A spaced repetition flashcard app using the FSRS algorithm. AI writes the cards from your notes, and smart scheduling shows each one just before you forget.',
		navLabel: 'Spaced repetition app',
		h1: 'A spaced repetition app with AI-made flashcards',
		intro:
			'Spaced repetition is the most efficient way to remember what you learn: you review each fact just as you are about to forget it. Toto Study combines the FSRS scheduling algorithm with AI that writes the flashcards for you.',
		steps: [
			'Create flashcards with AI from your documents and videos, or write your own.',
			'Review the cards that are due today and rate how well you remembered each one.',
			'FSRS schedules the next review for every card, so your daily queue is always the right size.',
		],
		sections: [
			{
				heading: 'Powered by FSRS',
				body: 'FSRS (Free Spaced Repetition Scheduler) models how memory fades for each card and picks review dates to hit your target retention. It typically needs fewer reviews than older schedulers for the same result.',
			},
			{
				heading: 'Tuned to you',
				body: 'Set your desired retention and maximum interval, and let the optimiser fit the scheduler to your own review history. Undo a mis-tapped rating with one click.',
			},
			{
				heading: 'A queue you can keep up with',
				body: 'Daily limits for new and review cards, load-balanced due dates and a 14-day forecast keep the workload steady, and difficult cards that keep coming back are flagged so you can fix them.',
			},
		],
		faqs: [
			{
				question: 'What is FSRS?',
				answer: 'FSRS is a modern, open spaced repetition algorithm that predicts when you will forget each card and schedules reviews to match.',
			},
			{
				question: 'Does it work offline?',
				answer: 'Yes. Flashcards are cached on your device so you can review without a connection, and progress syncs when you are back online.',
			},
			{
				question: 'Is there a mobile app?',
				answer: 'Yes. Toto Study runs on the web, iOS and Android, and your cards sync across all of them.',
			},
		],
	},
	{
		slug: 'ai-mind-map-generator',
		title: 'AI Mind Map Generator from PDFs, Notes and Videos',
		description:
			'Generate a mind map from any PDF, document or video with AI. See how the ideas connect at a glance, then turn the same material into flashcards and quizzes.',
		navLabel: 'AI mind map generator',
		h1: 'AI mind map generator for documents and videos',
		intro:
			'A mind map shows how the ideas in a topic connect, which is often the missing piece when notes feel like a list of disconnected facts. Toto Study builds one from your material automatically.',
		steps: [
			'Add a document, video, podcast or article.',
			'Generate a mind map. The AI organises the main topics, subtopics and key details into branches.',
			'Explore the map, then use the same source for flashcards, a quiz or a summary.',
		],
		sections: [
			{
				heading: 'See the big picture first',
				body: 'Start a new topic with the mind map to understand its structure, then go into the detail with confidence about where each piece fits.',
			},
			{
				heading: 'Connected to the rest of your study',
				body: 'The mind map sits alongside the summary, flashcards, quiz and glossary for the same source, so moving from overview to practice takes one click.',
			},
		],
		faqs: [
			{
				question: 'Can I make a mind map from a PDF?',
				answer: 'Yes. Upload the PDF and generate a mind map from it. The same works for Word documents, slides, videos and articles.',
			},
			{
				question: 'Is the mind map generator free?',
				answer: 'Toto Study is free to start. You use your own AI provider key, which is never stored on our servers.',
			},
		],
	},
]

/** The page's canonical path: always with a trailing slash (see the note at the top). */
export const featurePagePath = (slug: string): string => `/${slug}/`
