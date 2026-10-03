import { apiClient } from './apiClient';

interface AnkiCard {
  id: string;
  front: string;
  back: string;
}

/**
 * Server-built .apkg (real Anki package) with FSRS scheduling state carried over.
 * Exports all cards, or one course's cards when courseId is given.
 */
export async function downloadApkg(courseId?: string, fallbackName = 'study-platform'): Promise<void> {
  const params = courseId ? `?courseId=${courseId}` : '';
  const response = await apiClient.get(`/api/flashcards/export/apkg${params}`, { responseType: 'blob' });
  const disposition: string = response.headers['content-disposition'] ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : `${fallbackName}.apkg`;

  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadAnkiDeck(cards: AnkiCard[], deckName: string): Promise<void> {
  // Export as a tab-separated file compatible with Anki's import
  // This creates a proper Anki-importable text file (simpler than .apkg but fully functional)
  const lines = [
    '#separator:tab',
    '#html:false',
    '#notetype:Basic',
    `#deck:${deckName}`,
    ...cards.map(c => `${c.front.replace(/\t/g, ' ')}\t${c.back.replace(/\t/g, ' ')}`),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deckName.replace(/[^a-z0-9]/gi, '_')}_anki.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadCsvDeck(cards: AnkiCard[], deckName: string): Promise<void> {
  const lines = [
    'Front,Back',
    ...cards.map(c => `"${c.front.replace(/"/g, '""')}","${c.back.replace(/"/g, '""')}"`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${deckName.replace(/[^a-z0-9]/gi, '_')}_flashcards.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
