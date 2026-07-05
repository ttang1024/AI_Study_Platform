namespace StudyPlatform.Infrastructure.Services;

/// <summary>Prompt templates and prompt builders for AI generation/chat features.</summary>
internal static class AiPrompts
{
    public static string BuildDocumentChatPrompt(string truncatedDoc, string historyText, string userMessage) =>
        $@"You are a knowledgeable AI assistant. Answer the user's question using your broad general knowledge. The source context below is supplementary; use it when relevant, but do not restrict answers to only that context.

Source context:
{truncatedDoc}

Conversation history:
{historyText}

USER: {userMessage}

Provide a helpful, accurate, and complete answer. Discuss ideas directly and do not mention the source format or use phrases like ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", or ""the content"" unless quoting the user.";

    /// <summary>System prompt variant of the document chat prompt, for multimodal turns that carry image/PDF attachments alongside the user's message.</summary>
    public static string BuildDocumentChatSystem(string truncatedDoc) =>
        $@"You are a knowledgeable AI assistant. Answer the user's question using your broad general knowledge, taking into account any images or files the user attaches. The source context below is supplementary; use it when relevant, but do not restrict answers to only that context.

Source context:
{truncatedDoc}

Discuss ideas directly and do not mention the source format or use phrases like ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", or ""the content"" unless quoting the user.";

        private const string NoSourceMetaPhrases =
            @"Do not mention the source format or refer to the material with meta phrases such as ""this document"", ""the document"", ""this video"", ""the video"", ""the transcript"", ""the source material"", ""the content"", ""the text"", ""the speaker"", ""the lecture"", or similar wording. Discuss the ideas directly.";

        public const string MindMap =
            @"Create a detailed hierarchical study mind map in XMindMark format.
STRICT RULES:
Output ONLY the mind map text. No explanations, no JSON, no code fences.
First line MUST be the single root topic.
Use -  with exactly 4 spaces indentation per level.
Maximum 4 levels: Root → Main → Sub → Detail.
Make the map comprehensive enough for exam revision, not just a table of contents.
Use 5-9 main branches covering all major themes, arguments, processes, definitions, examples, and conclusions.
Each main branch should usually have 3-6 sub-branches.
Each sub-branch should usually have 2-4 detail nodes with specific facts, mechanisms, formulas, examples, causes, effects, limitations, or comparisons from the source.
Main and sub-branch nodes should be concise labels, usually 2-8 words.
Detail nodes may be short phrases up to 18 words when needed to preserve meaning.
Include named entities, key numbers, dates, formulas, assumptions, and concrete examples when present.
Avoid generic nodes such as Overview, Important Points, Key Ideas, or Conclusion unless the source uses them as real section topics.
Avoid repetition; merge duplicates and keep each branch conceptually distinct.
Do not invent details not supported by the source.
Do not include meta phrases about the source format in any node.
Example:
Main Topic
- Core Concept
    - Definition
        - Precise meaning from source
        - Related term or contrast
    - Why It Matters
        - Practical consequence
        - Common misconception
- Process or Framework
    - Step One
        - Trigger or input
        - Important constraint";

        public static readonly string Quiz =
            $@"Generate 3 to 10 multiple-choice questions from the supplied study material.
{NoSourceMetaPhrases}
Each question must have exactly 4 options. Each option must start with ""A. "", ""B. "", ""C. "", ""D. "" respectively.
correctAnswer MUST be only the matching letter: ""A"", ""B"", ""C"", or ""D"". Do not put the answer text in correctAnswer.
Return a JSON array only, no markdown, no code blocks:
[{{""question"": ""..."", ""options"": [""A. ..."",""B. ..."",""C. ..."",""D. ...""], ""correctAnswer"": ""A"", ""explanation"": ""...""}}]";

        public static string QuizForDifficulty(string difficulty) =>
            $@"{Quiz}
Difficulty: {QuizDifficultyLabel(difficulty)}.
Beginner questions should focus on recall and understanding.
Intermediate questions should focus on understanding and application.
Advanced questions should focus on application and analysis.";

        public static readonly string Flashcards =
            $@"Generate 15 flashcards from the supplied study material for spaced repetition learning.
{NoSourceMetaPhrases}
Use up to three card types — about 55% basic, 35% cloze, and up to 10% chart (only when quantitative data is present):
- basic: question on the front, concise answer on the back. Use LaTeX math ($...$) for formulas.
- cloze: a sentence with ONE key term in {{{{double braces}}}}. Leave back empty or a short hint.
- chart: front is a question about data; back is empty; add a chartData object.
  Only use chart when the source contains clear numerical or comparative data.
  chartData schema: {{""type"":""bar""|""line""|""pie"",""title"":""..."",""labels"":[...],""datasets"":[{{""label"":""..."",""data"":[numbers]}}]}}
Return a JSON array only, no markdown, no code blocks:
[{{""type"":""basic"",""front"":""..."",""back"":""...""}},{{""type"":""cloze"",""front"":""..{{{{term}}}}..."",""back"":""""}},{{""type"":""chart"",""front"":""..."",""back"":"""",""chartData"":{{""type"":""bar"",""title"":""..."",""labels"":[""A"",""B""],""datasets"":[{{""label"":""X"",""data"":[1,2]}}]}}}}]";

        public const string ExtractText =
            @"Transcribe ALL readable text content from the supplied file, preserving the natural reading order.
Output ONLY the transcribed text. No commentary, no code fences, no notes about the file.
Use Markdown headings and lists only where the source clearly has them.
For tables, output one row per line with cells separated by ' | '.
For purely visual elements (photos, diagrams, charts), add a short parenthetical description in place.
If the file contains no readable text, output nothing.";

        public static readonly string Glossary =
            $@"Extract 10-20 key terms and their definitions from the supplied study material.
{NoSourceMetaPhrases}
Focus on technical terms, concepts, and domain-specific vocabulary.
Return a JSON array only, no markdown, no code blocks: [{{""term"": ""..."", ""definition"": ""...""}}]";

        public static readonly string StreamSummary =
            $"Write a Markdown study summary. Start with exactly one concise, professional, academic overview paragraph covering the main thesis and conclusions. {NoSourceMetaPhrases} Follow with a '## Key Concepts' section explaining the most important ideas in detail. Then add a '## Key Takeaways' bullet list of 3-6 specific, informative points using '- '.";

        public static readonly string YouTubeStreamSummary =
            $"Write a Markdown study summary. Start with exactly one concise, professional, academic overview paragraph covering the main topic and conclusions. {NoSourceMetaPhrases} Follow with a '## Key Concepts' section explaining the most important ideas in detail. Then add a '## Key Takeaways' bullet list of 3-6 specific, informative points using '- '.";

        public static string TimelineStreamSummary(string mediaType) =>
            $@"Write a timeline-based study summary in Markdown.
Start with exactly one concise, professional, academic overview paragraph covering the main topic and conclusions.
{NoSourceMetaPhrases}
Then add a '## Timeline Summary' section with 3-6 chronological paragraphs. Each paragraph MUST start with a timestamp range from the timestamped source, formatted like '00:00 - 02:15' or '1:00:00 - 1:02:15', followed by a clear summary of what happens or is explained across that segment.
Group nearby timestamped fragments into meaningful segments instead of listing every line.
After the timeline, add a '## Key Concepts' section explaining the most important ideas in detail.
Finish with a '## Key Takeaways' bullet list of 3-6 specific, informative points using '- '.
Use only timestamp ranges that appear in or can be directly inferred from the supplied timestamps. If no timestamps are available, still summarize chronologically but omit timestamp prefixes.";

        public const string YouTubeMindMap =
            @"Generate a detailed study mind map from the supplied study material in XMindMark format.
STRICT RULES:
Output ONLY the mind map text. No explanations, no JSON, no code fences.
First line MUST be the single root topic.
Use -  with exactly 4 spaces indentation per level.
Maximum 4 levels: Root → Main → Sub → Detail.
Make the map comprehensive enough for exam revision, not just a video outline.
Use 5-9 main branches covering all major themes, arguments, processes, definitions, examples, demonstrations, and conclusions.
Each main branch should usually have 3-6 sub-branches.
Each sub-branch should usually have 2-4 detail nodes with specific facts, mechanisms, formulas, examples, causes, effects, limitations, or comparisons from the source.
Main and sub-branch nodes should be concise labels, usually 2-8 words.
Detail nodes may be short phrases up to 18 words when needed to preserve meaning.
Include named entities, key numbers, dates, formulas, assumptions, and concrete examples when present.
Preserve important sequence or cause-effect relationships.
Avoid generic nodes such as Overview, Important Points, Key Ideas, or Conclusion unless they are real section topics.
Avoid repetition; merge duplicates and keep each branch conceptually distinct.
Do not invent details not supported by the source.
Do not include meta phrases about the source format in any node.
Example:
Main Topic
- Core Concept
    - Definition
        - Precise meaning from source
        - Related term or contrast
    - Example
        - Specific example
        - Why example matters
- Demonstration or Process
    - Step One
        - Trigger or input
        - Important constraint";

        public static readonly string YouTubeQuiz =
            $@"Generate 3 to 10 multiple-choice quiz questions from the supplied study material.
{NoSourceMetaPhrases}
Each question must have exactly 4 options. Each option must start with ""A. "", ""B. "", ""C. "", ""D. "" respectively.
correctAnswer MUST be only the matching letter: ""A"", ""B"", ""C"", or ""D"". Do not put the answer text in correctAnswer.
Return a JSON array only, no markdown, no code blocks:
[{{""question"":""..."",""options"":[""A. ..."",""B. ..."",""C. ..."",""D. ...""],""correctAnswer"":""A"",""explanation"":""...""}}]";

        public static string YouTubeQuizForDifficulty(string difficulty) =>
            $@"{YouTubeQuiz}
Difficulty: {QuizDifficultyLabel(difficulty)}.
Beginner questions should focus on recall and understanding.
Intermediate questions should focus on understanding and application.
Advanced questions should focus on application and analysis.";

        private static string QuizDifficultyLabel(string difficulty) => difficulty?.ToLowerInvariant() switch
        {
            "easy" => "Beginner",
            "hard" => "Advanced",
            _ => "Intermediate"
        };

        public static readonly string YouTubeFlashcards =
            $@"Generate 5 to 10 flashcards from the supplied study material, focusing on the most important concepts only.
{NoSourceMetaPhrases}
Use up to three card types — about 55% basic, 35% cloze, and up to 10% chart (only if the video discusses quantitative data):
- basic: question on the front, concise answer on the back. Use LaTeX math ($...$) for formulas.
- cloze: a sentence with ONE key term in {{{{double braces}}}}. Leave back empty or a short hint.
- chart: front is a question; back is empty; include a chartData object (only when clear numerical data exists).
  chartData schema: {{""type"":""bar""|""line""|""pie"",""title"":""..."",""labels"":[...],""datasets"":[{{""label"":""..."",""data"":[numbers]}}]}}
Return a JSON array only, no markdown, no code blocks:
[{{""type"":""basic"",""front"":""..."",""back"":""...""}},{{""type"":""cloze"",""front"":""..{{{{term}}}}..."",""back"":""""}}]";

        public static readonly string YouTubeTutorInstruction =
            $"You are a knowledgeable AI assistant. Answer questions using your broad general knowledge. Source context may be supplied as supplementary context; use it when relevant, but do not restrict answers to only that context. If the user asks something beyond the context, answer from general knowledge. {NoSourceMetaPhrases}";

        public const string GeneralTutorInstruction =
            "You are a knowledgeable AI assistant. Answer any question the user asks using your broad general knowledge. Give clear, accurate, and helpful responses. Adjust depth to match the complexity of the question — be concise for simple questions, and thorough for complex ones.";
}
