import React from 'react';
import * as d3 from 'd3';
import { BrainCircuit } from 'lucide-react';
import { CONTENT_TYPE_ICONS, STUDY_TYPE_ICONS } from '../../constants/contentTypeIcons';
import { KnowledgeGraphEdge, KnowledgeGraphNode, GapSeverity } from '../../services/knowledgeGraphService';

export type GraphNode = KnowledgeGraphNode & d3.SimulationNodeDatum;
export type GraphLink = Omit<KnowledgeGraphEdge, 'source' | 'target'> & d3.SimulationLinkDatum<GraphNode>;

export const nodeStyles: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  concept: { color: '#0d9488', bg: '#ccfbf1', icon: BrainCircuit, label: 'Concept' }, // teal    ~160°
  document: { color: '#2563eb', bg: '#dbeafe', icon: CONTENT_TYPE_ICONS.document.icon, label: 'Document' }, // blue    ~240°
  article: { color: '#65a30d', bg: '#ecfccb', icon: CONTENT_TYPE_ICONS.article.icon, label: 'Article' }, // lime    ~80°
  audio: { color: '#0284c7', bg: '#e0f2fe', icon: CONTENT_TYPE_ICONS.audio.icon, label: 'Audio' }, // sky     ~200°
  podcast: { color: '#c026d3', bg: '#fae8ff', icon: CONTENT_TYPE_ICONS.podcast.icon, label: 'Podcast' }, // fuchsia ~300°
  video: { color: '#dc2626', bg: '#fee2e2', icon: CONTENT_TYPE_ICONS.video.icon, label: 'Video' }, // red     ~0°
  note: { color: STUDY_TYPE_ICONS.notes.color, bg: STUDY_TYPE_ICONS.notes.bg, icon: STUDY_TYPE_ICONS.notes.icon, label: 'Note' }, // violet  ~280°
  quiz: { color: STUDY_TYPE_ICONS.quiz.color, bg: STUDY_TYPE_ICONS.quiz.bg, icon: STUDY_TYPE_ICONS.quiz.icon, label: 'Quiz' }, // green   ~140°
  flashcard: { color: STUDY_TYPE_ICONS.flashcard.color, bg: STUDY_TYPE_ICONS.flashcard.bg, icon: STUDY_TYPE_ICONS.flashcard.icon, label: 'Flashcard' }, // amber   ~40°
};

export const getNodeStyle = (type: string) => nodeStyles[type] ?? nodeStyles.concept;

export const SEVERITY_COLORS: Record<GapSeverity, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#0891b2',
};

export const getNodeRadius = (node: KnowledgeGraphNode) => {
  if (node.type === 'concept') return Math.min(22, 9 + node.weight * 1.4);
  if (['document', 'video', 'article', 'audio', 'podcast'].includes(node.type)) return Math.min(28, 13 + node.weight * 1.6);
  return Math.min(20, 10 + node.weight);
};

export const getNodeTarget = (node: KnowledgeGraphNode) => node.url || undefined;
