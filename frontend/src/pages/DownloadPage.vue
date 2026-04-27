<template>
  <q-page class="bg-grey-10 q-pa-md">
    <div class="text-h6 text-grey-3 q-mb-md">⬇️ 다운로드</div>

    <!-- 모드 선택 -->
    <div class="row q-mb-md" style="background:#1e1e1e;border-radius:10px;padding:3px;gap:3px">
      <div
        v-for="m in modes"
        :key="m.value"
        class="col text-center q-py-xs cursor-pointer"
        :style="mode === m.value ? 'background:#e91e8c;border-radius:8px;color:white;font-weight:700' : 'color:#888'"
        style="font-size:12px;border-radius:8px"
        @click="mode = m.value"
      >
        {{ m.label }}
      </div>
    </div>

    <!-- URL 입력 -->
    <q-card flat class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-caption text-grey-5 q-mb-sm">SNS URL 입력</div>
        <q-input
          v-model="inputUrl"
          dark outlined
          placeholder="https://instagram.com/p/..."
          color="pink-5"
          class="q-mb-sm"
          clearable
        >
          <template #prepend><q-icon name="link" color="pink-4" /></template>
        </q-input>
        <q-btn
          unelevated full-width
          label="미디어 가져오기"
          color="pink-6"
          :loading="loading"
          :disable="!inputUrl.trim()"
          @click="onFetch"
        />
      </q-card-section>
    </q-card>

    <!-- 공유받기 안내 -->
    <q-card flat class="bg-grey-9 q-mb-md" style="border:1px dashed #444">
      <q-card-section class="text-center">
        <q-icon name="share" size="28px" color="grey-6" />
        <div class="text-caption text-grey-6 q-mt-xs">
          다른 앱에서 공유하기로 이 앱을 선택하면<br>자동으로 열립니다
        </div>
      </q-card-section>
    </q-card>

    <!-- 결과 미리보기 -->
    <q-card v-if="result" flat class="bg-grey-9">
      <div class="bg-grey-10 flex flex-center" style="height:140px;position:relative">
        <template v-if="result.media[previewIndex]">
          <q-img
            v-if="result.media[previewIndex].type === 'image'"
            :src="result.media[previewIndex].url"
            fit="contain"
            style="height:140px"
          />
          <video
            v-else
            :src="result.media[previewIndex].url"
            style="height:140px"
            muted autoplay loop
          />
        </template>

        <div class="absolute-bottom text-center q-pa-xs" style="font-size:10px;color:#888">
          ← 스와이프로 {{ result.media.length }}장 모두 확인 →
        </div>

        <q-btn
          v-if="previewIndex > 0"
          flat round icon="chevron_left" color="white" size="sm"
          class="absolute-left"
          @click="previewIndex--"
        />
        <q-btn
          v-if="previewIndex < result.media.length - 1"
          flat round icon="chevron_right" color="white" size="sm"
          class="absolute-right"
          @click="previewIndex++"
        />
      </div>

      <q-card-section>
        <div class="row items-center q-gutter-sm q-mb-sm">
          <platform-badge :platform="result.platform" />
          <span class="text-caption text-grey-5">{{ result.media.length }}개 미디어</span>
        </div>

        <q-input
          v-model="tagInput"
          dark outlined dense
          placeholder="태그 입력 (쉼표로 구분)"
          color="pink-5"
          class="q-mb-sm"
        />

        <q-btn
          unelevated full-width
          :label="mode === 'download' ? '📥 갤러리 저장 + 등록' : '🔖 북마크 등록'"
          color="pink-6"
          :loading="saving"
          @click="onSave"
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import PlatformBadge from '../components/PlatformBadge.vue'
import { useDownload } from '../composables/useDownload'
import { useMediaStore } from '../stores/mediaStore'
import { useTagStore } from '../stores/tagStore'

const $q = useQuasar()
const { fetchMediaInfo, downloadFile, generateFilename } = useDownload()
const mediaStore = useMediaStore()
const tagStore = useTagStore()

const modes = [
  { value: 'download', label: '⬇️ 다운로드' },
  { value: 'bookmark', label: '🔖 북마크' },
]

const mode = ref('download')
const inputUrl = ref('')
const loading = ref(false)
const saving = ref(false)
const result = ref(null)
const previewIndex = ref(0)
const tagInput = ref('')

async function onFetch() {
  loading.value = true
  result.value = null
  previewIndex.value = 0
  try {
    result.value = await fetchMediaInfo(inputUrl.value.trim())
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    loading.value = false
  }
}

async function onSave() {
  if (!result.value) return
  saving.value = true
  try {
    const tagNames = tagInput.value.split(',').map((s) => s.trim()).filter(Boolean)
    const tagObjs = []
    for (const name of tagNames) {
      const tag = await tagStore.findOrCreateTag(name)
      if (tag) tagObjs.push(tag)
    }

    const items = []
    let thumbnailPath = null

    if (mode.value === 'download') {
      for (let i = 0; i < result.value.media.length; i++) {
        const m = result.value.media[i]
        const filename = generateFilename(m.type, i)
        const filePath = await downloadFile(m.url, filename)
        if (i === 0) thumbnailPath = filePath
        items.push({ filePath, remoteUrl: null, type: m.type })
      }
    } else {
      const first = result.value.media[0]
      if (first) {
        const filename = generateFilename(first.type, 0)
        thumbnailPath = await downloadFile(first.url, filename)
      }
      for (const m of result.value.media) {
        items.push({ filePath: null, remoteUrl: m.url, type: m.type })
      }
    }

    await mediaStore.addGroup({
      sourceUrl: result.value.sourceUrl,
      platform: result.value.platform,
      mode: mode.value,
      thumbnailPath,
      items,
      tagIds: tagObjs.map((t) => t.id),
    })

    $q.notify({ type: 'positive', message: '등록 완료!' })
    result.value = null
    inputUrl.value = ''
    tagInput.value = ''
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    saving.value = false
  }
}
</script>
