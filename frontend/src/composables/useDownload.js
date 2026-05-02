import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import axios from 'axios'
import { BACKEND_URL } from '../config'
import { useWebAuth } from './useWebAuth'

export function useDownload() {
  const { getCookies, extractInstagramMedia } = useWebAuth()

  function detectPlatform(url) {
    if (url.includes('instagram.com')) return 'instagram'
    if (url.includes('x.com') || url.includes('twitter.com')) return 'x'
    return 'other'
  }

  async function fetchMediaInfo(url) {
    const platform = detectPlatform(url)

    // Instagram: 앱 WebView에서 직접 이미지 추출 시도 (캐러셀 전체 지원)
    if (platform === 'instagram') {
      const nativeResult = await extractInstagramMedia(url)
      const images = nativeResult?.images
      if (Array.isArray(images) && images.length > 0) {
        console.log('[native] extracted', images.length, 'image(s)')
        return {
          success: true,
          media: images.map((imgUrl, i) => ({ url: imgUrl, type: 'image', index: i }))
        }
      }
      console.log('[native] no images extracted, falling back to backend')
    }

    const cookies = await getCookies(platform)
    let data
    try {
      const res = await axios.post(
        `${BACKEND_URL}/api/fetch`,
        { url, cookies },
        { timeout: 30000 }
      )
      data = res.data
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      throw new Error(msg)
    }
    if (!data.success) throw new Error(data.message || '미디어 추출 실패')
    return data
  }

  async function downloadFile(remoteUrl, filename) {
    if (!Capacitor.isNativePlatform()) {
      console.warn('파일 저장은 네이티브 환경에서만 동작합니다.')
      return null
    }

    const proxyUrl = `${BACKEND_URL}/api/proxy?url=${encodeURIComponent(remoteUrl)}`
    const response = await axios.get(proxyUrl, { responseType: 'blob' })
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
