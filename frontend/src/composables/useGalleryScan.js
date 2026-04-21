import { Capacitor } from '@capacitor/core'
import { getDB } from '../stores/db'

export function useGalleryScan() {
  async function scanUnmanaged() {
    if (!Capacitor.isNativePlatform()) return []

    const db = getDB()
    if (!db) return []

    const registered = await db.query('SELECT filePath FROM media_items WHERE filePath IS NOT NULL')
    const registeredPaths = new Set((registered.values || []).map((r) => r.filePath))

    const { Media } = await import('@capacitor/media')
    const { medias } = await Media.getMedias({ types: 'all', thumbnailWidth: 200, thumbnailHeight: 200 })

    return medias.filter((m) => !registeredPaths.has(m.identifier))
  }

  return { scanUnmanaged }
}
