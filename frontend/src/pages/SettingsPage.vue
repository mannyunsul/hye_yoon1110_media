<template>
  <q-page class="bg-grey-10 q-pa-md">
    <div class="text-h6 text-grey-3 q-mb-md">⚙️ 설정</div>

    <!-- 계정 연결 카드 -->
    <q-card flat bordered class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-4 q-mb-sm">🔗 계정 연결</div>

        <!-- Instagram -->
        <div class="row items-center justify-between q-mb-sm">
          <div class="row items-center q-gutter-sm">
            <q-icon name="photo_camera" color="pink-4" />
            <span class="text-grey-3">Instagram</span>
            <q-badge v-if="igConnected" color="positive" label="연결됨" />
          </div>
          <q-btn
            v-if="!igConnected"
            unelevated dense
            label="로그인"
            color="pink-6"
            :loading="igLoading"
            @click="connectInstagram"
          />
          <q-btn
            v-else
            unelevated dense
            label="연결 해제"
            color="grey-7"
            @click="disconnectInstagram"
          />
        </div>

        <!-- X -->
        <div class="row items-center justify-between">
          <div class="row items-center q-gutter-sm">
            <q-icon name="close" color="grey-3" />
            <span class="text-grey-3">X (Twitter)</span>
            <q-badge v-if="xConnected" color="positive" label="연결됨" />
          </div>
          <q-btn
            v-if="!xConnected"
            unelevated dense
            label="로그인"
            color="grey-7"
            :loading="xLoading"
            @click="connectX"
          />
          <q-btn
            v-else
            unelevated dense
            label="연결 해제"
            color="grey-7"
            @click="disconnectX"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- 수동 백업 카드 -->
    <q-card flat bordered class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-4 q-mb-sm">💾 백업</div>

        <q-btn
          unelevated full-width
          label="백업 내보내기"
          icon="upload"
          color="grey-7"
          class="q-mb-sm"
          :loading="exporting"
          @click="onExport"
        />

        <q-btn
          unelevated full-width
          label="백업 가져오기"
          icon="download"
          color="grey-7"
          @click="triggerImport"
        />
        <input ref="fileInput" type="file" accept=".json" hidden @change="onImport" />
      </q-card-section>
    </q-card>

    <!-- 사용 가이드 카드 -->
    <q-card flat bordered class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-4 q-mb-sm">📖 사용 가이드</div>
        <q-btn
          unelevated full-width
          label="사용 가이드 보기"
          icon="help_outline"
          color="grey-7"
          to="/guide"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useBackup } from '../composables/useBackup'
import { useMediaStore } from '../stores/mediaStore'
import { useTagStore } from '../stores/tagStore'
import { useWebAuth } from '../composables/useWebAuth'

const $q = useQuasar()
const mediaStore = useMediaStore()
const tagStore = useTagStore()
const { exportBackup, importBackup } = useBackup()
const { login, logout, isLoggedIn } = useWebAuth()

const exporting = ref(false)
const fileInput = ref(null)
const igConnected = ref(false)
const xConnected = ref(false)
const igLoading = ref(false)
const xLoading = ref(false)

onMounted(async () => {
  igConnected.value = await isLoggedIn('instagram')
  xConnected.value = await isLoggedIn('x')
})

async function connectInstagram() {
  igLoading.value = true
  try {
    await login('instagram')
    igConnected.value = true
    $q.notify({ message: 'Instagram 연결 완료!' })
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    igLoading.value = false
  }
}

async function connectX() {
  xLoading.value = true
  try {
    await login('x')
    xConnected.value = true
    $q.notify({ message: 'X 연결 완료!' })
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    xLoading.value = false
  }
}

async function disconnectInstagram() {
  await logout('instagram')
  igConnected.value = false
}

async function disconnectX() {
  await logout('x')
  xConnected.value = false
}

async function onExport() {
  exporting.value = true
  try {
    await exportBackup()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    exporting.value = false
  }
}

function triggerImport() {
  fileInput.value?.click()
}

async function onImport(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const text = await file.text()
  $q.dialog({
    title: '백업 가져오기',
    message: '현재 로컬 데이터가 삭제되고 백업 파일로 대체됩니다. 계속할까요?',
    cancel: { label: '취소', flat: true },
    ok: { label: '가져오기', color: 'orange-6' },
    dark: true,
  }).onOk(async () => {
    try {
      await importBackup(text)
      await mediaStore.loadGroups()
      await tagStore.loadTags()
      $q.notify({ type: 'positive', message: '백업 복원 완료!' })
    } catch (err) {
      $q.notify({ type: 'negative', message: err.message })
    }
    event.target.value = ''
  })
}
</script>
