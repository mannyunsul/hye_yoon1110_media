<template>
  <q-page class="bg-grey-10 q-pa-md">
    <div class="text-h6 text-grey-3 q-mb-md">⚙️ 설정</div>

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
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useBackup } from '../composables/useBackup'
import { useMediaStore } from '../stores/mediaStore'
import { useTagStore } from '../stores/tagStore'

const $q = useQuasar()
const mediaStore = useMediaStore()
const tagStore = useTagStore()
const { exportBackup, importBackup } = useBackup()

const exporting = ref(false)
const fileInput = ref(null)

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
