import { ref } from 'vue'
import { registerPlugin } from '@capacitor/core'

const ShareReceiver = registerPlugin('ShareReceiver')

// 앱 전역에서 공유받은 URL을 공유하는 ref
const sharedUrl = ref('')

export function useSharedUrl() {
  async function init(router) {
    // 앱이 공유로 열린 경우 pendingUrl 확인
    try {
      const { url } = await ShareReceiver.getPendingUrl()
      if (url) {
        sharedUrl.value = url
        router.push('/download')
      }
    } catch {
      // 네이티브 환경 아닌 경우 무시
    }

    // 앱 실행 중 공유받은 경우 이벤트 수신
    try {
      await ShareReceiver.addListener('urlReceived', ({ url }) => {
        if (url) {
          sharedUrl.value = url
          router.push('/download')
        }
      })
    } catch {
      // 네이티브 환경 아닌 경우 무시
    }
  }

  function consumeSharedUrl() {
    const url = sharedUrl.value
    sharedUrl.value = ''
    return url
  }

  return { sharedUrl, init, consumeSharedUrl }
}
