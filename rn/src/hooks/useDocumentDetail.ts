import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

import { documentService } from '@/services/documentService';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { isKnownTab, type Tab } from '@/components/library/documentDetailMeta';
import type { Document } from '@/types';

/** Loads a document + its download URL and owns the detail screen's tab state. */
export function useDocumentDetail() {
  const { id, courseId, tab: initialTab } = useLocalSearchParams<{ id: string; courseId: string; tab?: string }>();
  const navigation = useNavigation();
  const [doc, setDoc] = useState<Document | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>(isKnownTab(initialTab) ? initialTab : 'summary');

  // Attribute reading/quizzing time on this document to its course in analytics.
  useStudyTimer({ contextType: 'document', courseId, contextId: id, enabled: !loading && !error });

  useEffect(() => {
    if (!id || !courseId) return;
    documentService.getDocument(courseId, id)
      .then((d) => {
        setDoc(d);
        // Route param changes reuse this screen instance — clear a stale error
        // from a previous document so the successful load actually renders.
        setError(false);
        navigation.setOptions({ title: d.name });
        documentService.getDownloadUrl(courseId, id).then(setDownloadUrl).catch(() => {});
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, courseId, navigation]);

  return { id, courseId, doc, setDoc, downloadUrl, loading, error, tab, setTab };
}

