export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface TagAssignment {
  itemId: string; // documentId or videoId
  itemType: 'document' | 'video';
  tagIds: string[];
}

const TAGS_KEY = 'study_tags';
const ASSIGNMENTS_KEY = 'study_tag_assignments';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#ef4444',
];

function getTags(): Tag[] {
  try {
    return JSON.parse(localStorage.getItem(TAGS_KEY) || '[]');
  } catch {
    return [];
  }
}

function getAssignments(): TagAssignment[] {
  try {
    return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export const tagService = {
  getAllTags(): Tag[] {
    return getTags();
  },

  createTag(name: string): Tag {
    const tags = getTags();
    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const newTag: Tag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      color: TAG_COLORS[tags.length % TAG_COLORS.length],
    };
    tags.push(newTag);
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
    return newTag;
  },

  deleteTag(tagId: string): void {
    const tags = getTags().filter(t => t.id !== tagId);
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
    // Remove tag from all assignments
    const assignments = getAssignments().map(a => ({
      ...a,
      tagIds: a.tagIds.filter(id => id !== tagId),
    }));
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  },

  getTagsForItem(itemId: string): Tag[] {
    const assignments = getAssignments();
    const assignment = assignments.find(a => a.itemId === itemId);
    if (!assignment) return [];
    const allTags = getTags();
    return assignment.tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean) as Tag[];
  },

  addTagToItem(itemId: string, itemType: 'document' | 'video', tagId: string): void {
    const assignments = getAssignments();
    const idx = assignments.findIndex(a => a.itemId === itemId);
    if (idx >= 0) {
      if (!assignments[idx].tagIds.includes(tagId)) {
        assignments[idx].tagIds.push(tagId);
      }
    } else {
      assignments.push({ itemId, itemType, tagIds: [tagId] });
    }
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  },

  removeTagFromItem(itemId: string, tagId: string): void {
    const assignments = getAssignments().map(a =>
      a.itemId === itemId ? { ...a, tagIds: a.tagIds.filter(id => id !== tagId) } : a,
    );
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
  },

  getItemsWithTag(tagId: string): string[] {
    return getAssignments()
      .filter(a => a.tagIds.includes(tagId))
      .map(a => a.itemId);
  },
};
