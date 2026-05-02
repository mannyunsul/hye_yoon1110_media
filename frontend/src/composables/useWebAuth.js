import { registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'

const WebAuth = registerPlugin('WebAuth')

const PREF_KEY = {
  instagram: 'cookies_instagram',
  x: 'cookies_x',
}

export function useWebAuth() {
  async function login(platform) {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('로그인은 앱에서만 가능합니다.')
    }
    const result = await WebAuth.login({ platform })
    if (!result.cookies) throw new Error('쿠키를 가져오지 못했습니다.')
    await Preferences.set({ key: PREF_KEY[platform], value: result.cookies })
    return result.cookies
  }

  async function getCookies(platform) {
    const { value } = await Preferences.get({ key: PREF_KEY[platform] })
    return value || null
  }

  async function logout(platform) {
    await Preferences.remove({ key: PREF_KEY[platform] })
  }

  async function isLoggedIn(platform) {
    const cookies = await getCookies(platform)
    return !!cookies
  }

  async function extractInstagramMedia(url, cookies) {
    if (!Capacitor.isNativePlatform()) return { images: [] }
    try {
      const result = await WebAuth.extractInstagramMedia({ url, cookies: cookies || '' })
      return result
    } catch (e) {
      console.warn('[WebAuth] extractInstagramMedia error:', e.message)
      return { images: [] }
    }
  }

  return { login, getCookies, logout, isLoggedIn, extractInstagramMedia }
}
