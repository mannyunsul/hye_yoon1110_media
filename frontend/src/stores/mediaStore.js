import { defineStore } from 'pinia'
import { getDB } from './db'
import { v4 as uuidv4 } from 'uuid'

export const useMediaStore = defineStore('media', {
  state: () => ({
    groups: [],
    loading: false,
  }),

  actions: {
    async loadGroups() {
      const db = getDB()
      if (!db) return
      this.loading = true
      const result = await db.query(
        'SELECT * FROM media_groups ORDER BY registeredAt DESC'
      )
      const groups = result.values || []

      for (const group of groups) {
        const tagResult = await db.query(
          'SELECT t.id, t.name FROM tags t JOIN group_tags gt ON t.id = gt.tagId WHERE gt.groupId = ?',
          [group.id]
        )
        const tags = tagResult.values || []
        group._tagIds = tags.map((t) => t.id)
        group._tagNames = tags.map((t) => t.name)
      }

      this.groups = groups
      this.loading = false
    },

    async addGroup({ sourceUrl, platform, mode, thumbnailPath, items, tagIds }) {
      const db = getDB()
      if (!db) return

      const groupId = uuidv4()
      const now = new Date().toISOString()

      await db.run(
        `INSERT INTO media_groups (id, sourceUrl, platform, mode, thumbnailPath, totalCount, createdAt, registeredAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [groupId, sourceUrl, platform, mode, thumbnailPath || null, items.length, now, now]
      )

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        await db.run(
          `INSERT INTO media_items (id, groupId, filePath, remoteUrl, type, itemIndex, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), groupId, item.filePath || null, item.remoteUrl || null, item.type, i, now]
        )
      }

      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await db.run(
            'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
            [groupId, tagId]
          )
          await db.run(
            'UPDATE tags SET count = count + 1 WHERE id = ?',
            [tagId]
          )
        }
      }

      await this.loadGroups()
      return groupId
    },

    async deleteGroup(groupId) {
      const db = getDB()
      if (!db) return

      // 연결된 태그 ID 조회 후 count 감소
      const tagResult = await db.query(
        'SELECT tagId FROM group_tags WHERE groupId = ?',
        [groupId]
      )
      const tagIds = (tagResult.values || []).map((r) => r.tagId)
      for (const tagId of tagIds) {
        await db.run(
          'UPDATE tags SET count = MAX(0, count - 1) WHERE id = ?',
          [tagId]
        )
      }

      // 수동 cascade (PRAGMA foreign_keys 꺼져 있으므로)
      await db.run('DELETE FROM group_tags WHERE groupId = ?', [groupId])
      await db.run('DELETE FROM media_items WHERE groupId = ?', [groupId])
      await db.run('DELETE FROM media_groups WHERE id = ?', [groupId])

      await this.loadGroups()
    },

    async deleteItem(itemId, groupId) {
      const db = getDB()
      if (!db) return
      await db.run('DELETE FROM media_items WHERE id = ?', [itemId])
      const result = await db.query(
        'SELECT COUNT(*) as cnt FROM media_items WHERE groupId = ?',
        [groupId]
      )
      const cnt = result.values?.[0]?.cnt ?? 0
      if (cnt === 0) {
        await this.deleteGroup(groupId)
      } else {
        await db.run(
          'UPDATE media_groups SET totalCount = ? WHERE id = ?',
          [cnt, groupId]
        )
        await this.loadGroups()
      }
    },

    async getItemsByGroup(groupId) {
      const db = getDB()
      if (!db) return []
      const result = await db.query(
        'SELECT * FROM media_items WHERE groupId = ? ORDER BY itemIndex ASC',
        [groupId]
      )
      return result.values || []
    },
  },
})
