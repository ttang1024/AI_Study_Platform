import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Calendar from 'lucide-react-native/icons/calendar';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import FileText from 'lucide-react-native/icons/file-text';
import Globe from 'lucide-react-native/icons/globe';
import Mic from 'lucide-react-native/icons/mic';
import Video from 'lucide-react-native/icons/video';
import X from 'lucide-react-native/icons/x';

import { Alpha, Colors, Layout, Overlay, Radius, Spacing, Typography } from '@/constants/theme';
import { libraryService, type LibraryEntry } from '@/services/libraryService';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MAX_VISIBLE = 3;

type EntryDisplayType = 'doc' | 'article' | 'audio' | 'video';

interface CalendarEntry {
  id: string;
  name: string;
  kind: 'document' | 'video';
  displayType: EntryDisplayType;
  courseName?: string;
  courseColor?: string;
}

const TYPE_ICON: Record<EntryDisplayType, typeof FileText> = {
  doc: FileText,
  article: Globe,
  audio: Mic,
  video: Video,
};

const TYPE_COLOR: Record<EntryDisplayType, string> = {
  doc: Colors.blue,
  article: Colors.teal,
  audio: Colors.amber,
  video: Colors.red,
};

const toLocalDateStr = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toEntry = (item: LibraryEntry): { date: string; entry: CalendarEntry } | null => {
  if (item.kind === 'video') {
    const v = item.data;
    if (!v.createdAt) return null;
    return {
      date: toLocalDateStr(v.createdAt),
      entry: { id: v.id, name: v.title, kind: 'video', displayType: 'video', courseName: v.courseName, courseColor: v.courseColor },
    };
  }
  const d = item.data;
  if (!d.uploadDate) return null;
  const displayType: EntryDisplayType = d.type === 'audio' || d.type === 'podcast' ? 'audio' : d.originalUrl ? 'article' : 'doc';
  return {
    date: toLocalDateStr(d.uploadDate),
    entry: { id: d.id, name: d.name, kind: 'document', displayType, courseName: d.courseName, courseColor: d.courseColor },
  };
};

const entryHref = (entry: CalendarEntry) =>
  entry.kind === 'video'
    ? ({ pathname: '/library/video/[id]', params: { id: entry.id } } as const)
    : ({ pathname: '/library/document/[id]', params: { id: entry.id } } as const);

export function StudyCalendar() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toLocalDateStr(today.toISOString()), [today]);

  const [calendarDate, setCalendarDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [dayMap, setDayMap] = useState<Record<string, CalendarEntry[]> | null>(null);
  const [popupDate, setPopupDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    libraryService.getLibrary({ type: 'all', pageSize: 100 }).then((res) => {
      if (!active) return;
      const map: Record<string, CalendarEntry[]> = {};
      res.items.forEach((item) => {
        const mapped = toEntry(item);
        if (!mapped) return;
        (map[mapped.date] ??= []).push(mapped.entry);
      });
      setDayMap(map);
    });
    return () => { active = false; };
  }, []);

  if (!dayMap) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const popupEntries = popupDate ? (dayMap[popupDate] ?? []) : [];
  const popupLabel = popupDate
    ? new Date(`${popupDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLabel}>
            <Calendar size={16} color={Colors.primary} />
            <Text style={styles.headerText}>{MONTHS[month]} {year}</Text>
          </View>
          <View style={styles.headerNav}>
            <Pressable style={styles.navButton} onPress={() => setCalendarDate(new Date(year, month - 1, 1))}>
              <ChevronLeft size={16} color={Colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.todayButton} onPress={() => setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1))}>
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
            <Pressable style={styles.navButton} onPress={() => setCalendarDate(new Date(year, month + 1, 1))}>
              <ChevronRight size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={styles.weekdayText}>{d}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`e-${i}`} style={styles.cellEmpty} />;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entries = dayMap[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const overflow = entries.length - MAX_VISIBLE;

            return (
              <View key={dateStr} style={[styles.cell, isFuture && styles.cellFuture]}>
                <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                  <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{day}</Text>
                </View>
                {entries.slice(0, MAX_VISIBLE).map((entry) => {
                  const color = entry.courseColor ?? TYPE_COLOR[entry.displayType];
                  return (
                    <Pressable
                      key={entry.id}
                      style={[styles.chip, { backgroundColor: `${color}22` }]}
                      onPress={() => router.push(entryHref(entry), { withAnchor: true })}
                    >
                      <Text style={[styles.chipText, { color }]} numberOfLines={1}>{entry.name}</Text>
                    </Pressable>
                  );
                })}
                {overflow > 0 && (
                  <Pressable onPress={() => setPopupDate(dateStr)}>
                    <Text style={styles.overflowText}>+{overflow} more</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <Modal visible={!!popupDate} transparent animationType="fade" onRequestClose={() => setPopupDate(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPopupDate(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View style={styles.headerLabel}>
                <Calendar size={16} color={Colors.primary} />
                <Text style={styles.headerText}>{popupLabel}</Text>
              </View>
              <Pressable onPress={() => setPopupDate(null)}>
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalList}>
              {popupEntries.map((entry) => {
                const color = entry.courseColor ?? TYPE_COLOR[entry.displayType];
                const Icon = TYPE_ICON[entry.displayType];
                return (
                  <Pressable
                    key={entry.id}
                    style={styles.modalRow}
                    onPress={() => { setPopupDate(null); router.push(entryHref(entry), { withAnchor: true }); }}
                  >
                    <View style={[styles.modalIcon, { backgroundColor: `${color}22` }]}>
                      <Icon size={14} color={color} />
                    </View>
                    <View style={styles.modalRowBody}>
                      <Text style={styles.modalRowTitle} numberOfLines={1}>{entry.name}</Text>
                      <Text style={styles.modalRowSubtitle}>{entry.courseName ?? entry.displayType}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard, overflow: 'hidden',
  },
  loadingCard: { minHeight: 160, ...Layout.center },

  header: {
    ...Layout.rowBetween, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  headerLabel: { ...Layout.row, gap: Spacing.two },
  headerText: { ...Typography.bodyBold, color: Colors.textPrimary },
  headerNav: { ...Layout.row, gap: 4 },
  navButton: { padding: 6, borderRadius: Radius.sm },
  todayButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: `${Colors.primary}${Alpha.tint}` },
  todayButtonText: { ...Typography.captionBold, color: Colors.primary },

  weekdayRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.border },
  weekdayText: {
    width: '14.28%', textAlign: 'center', paddingVertical: 6, fontSize: 10, fontWeight: '700',
    color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellEmpty: {
    width: '14.28%', minHeight: 76, backgroundColor: `${Colors.textSecondary}${Alpha.wash}`,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  cell: {
    width: '14.28%', minHeight: 76, padding: 4, gap: 2,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  cellFuture: { opacity: 0.4 },

  dayBadge: { width: 18, height: 18, borderRadius: 9, ...Layout.center },
  dayBadgeToday: { backgroundColor: Colors.primary },
  dayNumber: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  dayNumberToday: { color: Colors.white },

  chip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  chipText: { fontSize: 8, fontWeight: '600' },
  overflowText: { fontSize: 8, fontWeight: '700', color: Colors.textSecondary },

  modalBackdrop: { ...Layout.fillCenter, backgroundColor: Overlay.backdrop, padding: Spacing.four },
  modalCard: {
    width: '100%', maxHeight: '70%', backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  modalHeader: {
    ...Layout.rowBetween, padding: Spacing.three, borderBottomWidth: 1, borderColor: Colors.border,
  },
  modalList: { padding: Spacing.two },
  modalRow: { ...Layout.row, gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md },
  modalIcon: { width: 28, height: 28, borderRadius: Radius.sm, ...Layout.center },
  modalRowBody: { flex: 1 },
  modalRowTitle: { ...Typography.bodyBold, fontSize: 13, color: Colors.textPrimary },
  modalRowSubtitle: { ...Typography.caption, fontSize: 10, color: Colors.textSecondary, textTransform: 'capitalize', marginTop: 1 },
});
