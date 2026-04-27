import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Capacitor } from '@capacitor/core'
import { getDB } from '../stores/db'

export function useBackup() {
  async function exportBackup() {
    const db = getDB()
    if (!db) throw new Error('DB가 초기화되지 않았습니다.')

    const groups = (await db.query('SELECT * FROM media_groups')).values || []
    const items = (await db.query('SELECT * FROM media_items')).values || []
    const tags = (await db.query('SELECT * FROM tags')).values || []
    const groupTags = (await db.query('SELECT * FROM group_tags')).values || []

    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      media_groups: groups,
      media_items: items,
      tags,
      group_tags: groupTags,
    }

    const json = JSON.stringify(payload, null, 2)
    const filename = `hyeyoon_backup_${Date.now()}.json`

    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({
        path: filename,
        data: btoa(unescape(encodeURIComponent(json))),
        directory: Directory.Cache,
      })
      await Share.share({
        title: '미디어 매니저 백업',
        files: [result.uri],
      })
    } else {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function importBackup(jsonString) {
    const db = getDB()
    if (!db) throw new Error('DB가 초기화되지 않았습니다.')

    let payload
    try { payload = JSON.parse(jsonString) }
    catch { throw new Error('올바른 백업 파일이 아닙니다.') }

    if (!payload.version || !payload.media_groups) {
      throw new Error('지원하지 않는 백업 형식입니다.')
    }

    await db.run('DELETE FROM media_groups')
    await db.run('DELETE FROM tags')

    for (const g of payload.media_groups || []) {
      await db.run(
        `INSERT OR REPLACE INTO media_groups
         (id, sourceUrl, platform, mode, thumbnailPath, totalCount, createdAt, registeredAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [g.id, g.sourceUrl, g.platform, g.mode, g.thumbnailPath, g.totalCount, g.createdAt, g.registeredAt]
      )
    }

    for (const item of payload.media_items || []) {
      await db.run(
        `INSERT OR REPLACE INTO media_items
         (id, groupId, filePath, remoteUrl, type, itemIndex, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.groupId, item.filePath, item.remoteUrl, item.type, item.itemIndex, item.createdAt]
      )
    }

    for (const tag of payload.tags || []) {
      await db.run(
        'INSERT OR REPLACE INTO tags (id, name, count, createdAt) VALUES (?, ?, ?, ?)',
        [tag.id, tag.name, tag.count, tag.createdAt]
      )
    }

    for (const gt of payload.group_tags || []) {
      await db.run(
        'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
        [gt.groupId, gt.tagId]
      )
    }
  }

  return { exportBackup, importBackup }
}
