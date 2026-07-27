import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { HtmlContent } from '@/components/HtmlContent';
import { SummaryMarkdown } from '@/components/SummaryMarkdown';
import type { SharedContent } from '@/services/shareService';
import type { ChatMessage, SharedTab } from '@/hooks/useSharedContent';
import { sharedSectionStyles } from './sharedSectionStyles';
import { SharedFlashcards } from './SharedFlashcards';
import { SharedQuizQuestion } from './SharedQuizQuestion';

interface Props {
  tab: SharedTab | null;
  content: SharedContent;
  sourceType: string | null;
  mindMapHtml: string | null;
  chatMessages: ChatMessage[] | null;
}

/** The active tab's content: summary, mind map, notes/chat transcript, flashcards, glossary or quiz. */
export function SharedContentBody({ tab, content, sourceType, mindMapHtml, chatMessages }: Props) {
  return (
    <>
      {tab === 'summary' && !!content.summary && (
        <View style={sharedSectionStyles.sectionCard}>
          <Text style={sharedSectionStyles.sectionLabel}>Summary</Text>
          <SummaryMarkdown value={content.summary} />
        </View>
      )}

      {tab === 'mindmap' && !!mindMapHtml && (
        <View style={styles.mindMapBox}>
          <WebView source={{ html: mindMapHtml }} style={styles.mindMapWebView} originWhitelist={['*']} bounces={false} />
        </View>
      )}

      {tab === 'notes' && !!content.notesHtml && (
        <View style={sharedSectionStyles.sectionCard}>
          <Text style={sharedSectionStyles.sectionLabel}>{sourceType === 'chat' ? 'Conversation' : 'Notes'}</Text>
          {chatMessages ? (
            <View style={styles.chatList}>
              {chatMessages.map((m, i) => (
                <View key={i} style={[styles.chatBubble, m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleModel]}>
                  <Text style={[styles.chatText, m.role === 'user' && styles.chatTextUser]}>{m.content}</Text>
                </View>
              ))}
            </View>
          ) : (
            <HtmlContent html={content.notesHtml} />
          )}
        </View>
      )}

      {tab === 'flashcards' && !!content.flashcards?.length && (
        <SharedFlashcards cards={content.flashcards} />
      )}

      {tab === 'glossary' && !!content.glossary?.length && (
        <View style={sharedSectionStyles.sectionCard}>
          <Text style={sharedSectionStyles.sectionLabel}>Glossary</Text>
          {content.glossary.map((g, i) => (
            <View key={i} style={styles.glossaryRow}>
              <Text style={styles.glossaryTerm}>{g.term}</Text>
              <Text style={styles.glossaryDef}>{g.definition}</Text>
            </View>
          ))}
        </View>
      )}

      {tab === 'quiz' && !!content.quizzes?.length && (
        <View style={sharedSectionStyles.sectionCard}>
          <Text style={sharedSectionStyles.sectionLabel}>Quiz</Text>
          {content.quizzes.map((q, i) => (
            <SharedQuizQuestion key={i} index={i} question={q} />
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  mindMapBox: { height: 420, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.bgCard, ...Shadows.card },
  mindMapWebView: { flex: 1, backgroundColor: Colors.bgCard },
  chatList: { gap: Spacing.two },
  chatBubble: { borderRadius: Radius.lg, padding: Spacing.two, maxWidth: '88%' },
  chatBubbleUser: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  chatBubbleModel: { alignSelf: 'flex-start', backgroundColor: Colors.zinc200 },
  chatText: { ...Typography.body, color: Colors.textPrimary },
  chatTextUser: { color: Colors.primaryForeground },
  glossaryRow: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  glossaryTerm: { ...Typography.bodyBold, color: Colors.textPrimary },
  glossaryDef: { ...Typography.caption, color: Colors.textSecondary },
});
