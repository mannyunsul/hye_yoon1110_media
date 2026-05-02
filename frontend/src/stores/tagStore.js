import { defineStore } from 'pinia';
import { getDB } from './db';
import { v4 as uuidv4 } from 'uuid';

const CHOSUNG = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_UNICODE_START = 0xAC00;
const CHOSUNG_STEP = 21 * 28;

function getChosung(char) {
  const code = char.charCodeAt(0);
  if (code >= CHOSUNG_UNICODE_START && code <= 0xD7A3) {
    const idx = Math.floor((code - CHOSUNG_UNICODE_START) / CHOSUNG_STEP);
    return CHOSUNG[idx] || '#';
  }
  return '#';
}

export const useTagStore = defineStore('tag', {
  state: () => ({
    tags: [],
  }),

  getters: {
    sortedByCount: (state) =>
      [...state.tags].sort((a, b) => b.count - a.count),

    byChosung: (state) => {
      const grouped = {};
      for (const tag of state.tags) {
        const cs = getChosung(tag.name[0]);
        if (!grouped[cs]) grouped[cs] = [];
        grouped[cs].push(tag);
      }
      return grouped;
    },
  },

  actions: {
    async loadTags() {
      const db = getDB();
      if (!db) return;
      const result = await db.query('SELECT * FROM tags ORDER BY name ASC');
      this.tags = result.values || [];
    },

    async findOrCreateTag(name) {
      const db = getDB();
      if (!db) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;

      const existing = await db.query(
        'SELECT * FROM tags WHERE name = ?',
        [trimmed]
      );
      if (existing.values?.length > 0) return existing.values[0];

      const id = uuidv4();
      const now = new Date().toISOString();
      await db.run(
        'INSERT INTO tags (id, name, count, createdAt) VALUES (?, ?, 0, ?)',
        [id, trimmed, now]
      );
      await this.loadTags();
      return { id, name: trimmed, count: 0, createdAt: now };
    },

    async getTagsByGroup(groupId) {
      const db = getDB();
      if (!db) return [];
      const result = await db.query(
        `SELECT t.* FROM tags t
         INNER JOIN group_tags gt ON t.id = gt.tagId
         WHERE gt.groupId = ?`,
        [groupId]
      );
      return result.values || [];
    },

    async removeTagFromGroup(groupId, tagId) {
      const db = getDB();
      if (!db) return;
      await db.run(
        'DELETE FROM group_tags WHERE groupId = ? AND tagId = ?',
        [groupId, tagId]
      );
      await db.run(
        'UPDATE tags SET count = MAX(0, count - 1) WHERE id = ?',
        [tagId]
      );
      await this.loadTags();
    },

    async deleteTag(tagId) {
      const db = getDB();
      if (!db) return;
      await db.run('DELETE FROM group_tags WHERE tagId = ?', [tagId]);
      await db.run('DELETE FROM tags WHERE id = ?', [tagId]);
      await this.loadTags();
    },
  },
});
