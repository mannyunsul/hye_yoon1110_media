<template>
  <q-page class="bg-grey-10 column">
    <!-- 헤더 -->
    <div class="row items-center justify-between q-pa-sm">
      <span class="text-caption text-grey-5">갤러리 미등록 {{ unmanagedItems.length }}개</span>
      <q-btn
        v-if="selected.length > 0"
        unelevated dense
        :label="`태그 등록 (${selected.length})`"
        color="pink-6"
        @click="showTagDialog = true"
      />
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="pink-5" size="32px" />
    </div>

    <!-- 그리드 -->
    <div v-else class="unmanaged-grid">
      <div
        v-for="item in unmanagedItems"
        :key="item.identifier"
        class="grid-item"
        :class="{ selected: selected.includes(item.identifier) }"
        @click="toggleSelect(item)"
      >
        <q-img
          :src="item.thumbnailUri || item.identifier"
          fit="cover"
          class="full-width full-height"
        />
        <div class="select-overlay">
          <q-icon
            :name="selected.includes(item.identifier) ? 'check_circle' : 'radio_button_unchecked'"
            :color="selected.includes(item.identifier) ? 'pink-5' : 'white'"
            size="20px"
          />
        </div>
      </div>
    </div>

    <!-- 태그 입력 다이얼로그 -->
    <tag-input-dialog
      v-model="showTagDialog"
      :initial-tags="[]"
      @save="onRegister"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import TagInputDialog from '../components/TagInputDialog.vue'
import { useGalleryScan } from '../composables/useGalleryScan'
import { useMediaStore } from '../stores/mediaStore'

const $q = useQuasar()
const { scanUnmanaged } = useGalleryScan()
const mediaStore = useMediaStore()

const unmanagedItems = ref([])
const selected = ref([])
const loading = ref(false)
const showTagDialog = ref(false)

onMounted(async () => {
  loading.value = true
  unmanagedItems.value = await scanUnmanaged()
  loading.value = false
})

function toggleSelect(item) {
  const idx = selected.value.indexOf(item.identifier)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(item.identifier)
}

async function onRegister(tags) {
  const tagIds = tags.map((t) => t.id)
  for (const identifier of selected.value) {
    const item = unmanagedItems.value.find((i) => i.identifier === identifier)
    if (!item) continue
    await mediaStore.addGroup({
      sourceUrl: null,
      platform: 'camera',
      mode: 'gallery',
      thumbnailPath: item.thumbnailUri || item.identifier,
      items: [{ filePath: item.identifier, remoteUrl: null, type: item.mediaType === 'video' ? 'video' : 'image' }],
      tagIds,
    })
  }
  selected.value = []
  unmanagedItems.value = await scanUnmanaged()
  $q.notify({ type: 'positive', message: '등록 완료!' })
}
</script>

<style scoped>
.unmanaged-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
}
.grid-item {
  aspect-ratio: 1; background: #2a2a2a;
  position: relative; overflow: hidden; cursor: pointer;
}
.select-overlay {
  position: absolute; top: 4px; right: 4px;
}
</style>
