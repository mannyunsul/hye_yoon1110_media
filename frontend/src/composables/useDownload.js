import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import axios from 'axios'
import { BACKEND_URL } from '../config'

export function useDownload() {
  async function fetchMediaInfo(url) {
    const { data } = await axios.post(`${BACKEND_URL}/api/fetch`, { url }, { timeout: 30000 })
    if (!data.success) throw new Error(data.message || '미디어 추출 실패')
    return data // { platform, sourceUrl, media: [{url, type, index}] }
  }

  async function downloadFile(remoteUrl, filename) {
    if (!Capacitor.isNativePlatform()) {
      console.warn('파일 저장은 네이티브 환경에서만 동작합니다.')
      return null
    }

    const response = await axios.get(remoteUrl, { responseType: 'blob' })
    const blob = response.data
    const base64 = await blobToBase64(blob)

    const result = await Filesystem.writeFile({
      path: `MediaManager/${filename}`,
      data: base64,
      directory: Directory.External,
      recursive: true,
    })

    return result.uri
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  function generateFilename(type, index) {
    const ts = Date.now()
    const ext = type === 'video' ? 'mp4' : 'jpg'
    return `media_${ts}_${index}.${ext}`
  }

  return { fetchMediaInfo, downloadFile, generateFilename }
}
