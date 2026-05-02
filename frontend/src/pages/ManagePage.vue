<template>
  <q-page class="bg-grey-10 column">
    <!-- 검색 -->
    <q-input
      v-model="search"
      dark outlined dense
      placeholder="검색"
      color="pink-5"
      class="q-ma-sm"
      clearable
    >
      <template #prepend><q-icon name="search" color="grey-6" /></template>
    </q-input>

    <!-- 태그 필터바 -->
    <tag-filter-bar
      v-model="selectedTagId"
      @open-all="showTagList = true"
    />

    <!-- 플랫폼 필터 -->
    <div class="row q-px-md q-gutter-xs q-mb-sm">
      <q-chip
        v-for="p in platforms"
        :key="p.value"
        clickable dense
        :color="selectedPlatform === p.value ? 'deep-purple-8' : 'grey-9'"
        text-color="white"
        :label="p.label"
        @click="selectedPlatform = p.value"
      />
    </div>

    <!-- 그리드 -->
    <media-grid
      :groups="filteredGroups"
      class="flex-grow"
      @tap="openBottomSheet"
      @longpress="openLongpress"
    />

    <!-- 바텀 시트 -->
    <media-bottom-sheet
      v-if="selectedGroup"
      v-model="showBottomSheet"
      :group="selectedGroup"
      @deleted="onGroupDeleted"
    />

    <!-- 롱프레스 메뉴 -->
    <q-dialog v-model="showLongpress" position="bottom">
      <q-list class="bg-grey-9 rounded-borders" style="min-width:200px">
        <q-item clickable v-close-popup @click="openSourceUrl">
          <q-item-section avatar><q-icon name="open_in_new" color="grey-4" /></q-item-section>
          <q-item-section class="text-grey-3">출처 열기</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="openTagEdit">
          <q-item-section avatar><q-icon name="label" color="grey-4" /></q-item-section>
          <q-item-section class="text-grey-3">태그 편집</q-item-section>
        </q-item>
        <q-separator dark />
        <q-item clickable v-close-popup @click="confirmDelete">
          <q-item-section avatar><q-icon name="delete" color="red-4" /></q-item-section>
          <q-item-section class="text-red-4">전체 삭제</q-item-section>
        </q-item>
      </q-list>
    </q-dialog>

    <!-- 태그 편집 다이얼로그 -->
    <tag-input-dialog
      v-if="selectedGroup"
      v-model="showTagEdit"
      :initial-tags="selectedGroupTags"
      @save="onSaveTagEdit"
    />

    <!-- 태그 전체 목록 -->
    <tag-list-sheet
      v-model="showTagList"
      @select="onSelectTagFromList"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import MediaGrid from '../components/MediaGrid.vue'
import MediaBottomSheet from '../components/MediaBottomSheet.vue'
import TagFilterBar from '../components/TagFilterBar.vue'
import TagInputDialog from '../components/TagInputDialog.vue'
import TagListSheet from '../components/TagListSheet.vue'
import { useMediaStore } from '../stores/mediaStore'
import { useTagStore } from '../stores/tagStore'
import { getDB } from '../stores/db'

const $q = useQuasar()
const mediaStore = useMediaStore()
const tagStore = useTagStore()

const search = ref('')
const selectedTagId = ref(null)
const selectedPlatform = ref('all')
const showBottomSheet = ref(false)
const showLongpress = ref(false)
const showTagEdit = ref(false)
const showTagList = ref(false)
const selectedGroup = ref(null)
const selectedGroupTags = ref([])

const platforms = [
  { value: 'all', label: '전체' },
  { value: 'instagram', label: '📸 IG' },
  { value: 'x', label: '✖ X' },
  { value: 'tiktok', label: '🎵 TT' },
  { value: 'youtube', label: '▶ YT' },
]

onMounted(async () => {
  await mediaStore.loadGroups()
  await tagStore.loadTags()
})

const filteredGroups = computed(() => {
  let groups = mediaStore.groups

  if (selectedPlatform.value !== 'all') {
    groups = groups.filter((g) => g.platform === selectedPlatform.value)
  }

  if (selectedTagId.value) {
    groups = groups.filter((g) => g._tagIds?.includes(selectedTagId.value))
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    groups = groups.filter(
      (g) =>
        g.sourceUrl?.toLowerCase().includes(q) ||
        g._tagNames?.some((n) => n.includes(q))
    )
  }

  return groups
})

function openBottomSheet(group) {
  selectedGroup.value = group
  showBottomSheet.value = true
}

async function openLongpress(group) {
  selectedGroup.value = group
  selectedGroupTags.value = await tagStore.getTagsByGroup(group.id)
  showLongpress.value = true
}

function openSourceUrl() {
  if (selectedGroup.value?.sourceUrl) {
    window.open(selectedGroup.value.sourceUrl, '_blank')
  }
}

function openTagEdit() {
  showTagEdit.value = true
}

async function onSaveTagEdit(newTags) {
  const db = getDB()
  const groupId = selectedGroup.value.id

  // 기존 태그와 새 태그 비교
  const oldIds = new Set(selectedGroupTags.value.map((t) => t.id))
  const newIds = new Set(newTags.map((t) => t.id))

  // 제거된 태그 count 감소
  for (const tag of selectedGroupTags.value) {
    if (!newIds.has(tag.id)) {
      await db.run(
        'UPDATE tags SET count = MAX(0, count - 1) WHERE id = ?',
        [tag.id]
      )
    }
  }

  // 추가된 태그 count 증가
  for (const tag of newTags) {
    if (!oldIds.has(tag.id)) {
      await db.run(
        'UPDATE tags SET count = count + 1 WHERE id = ?',
        [tag.id]
      )
    }
  }

  // group_tags 갱신
  await db.run('DELETE FROM group_tags WHERE groupId = ?', [groupId])
  for (const tag of newTags) {
    await db.run(
      'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
      [groupId, tag.id]
    )
  }

  await tagStore.loadTags()
  await mediaStore.loadGroups()
}

function confirmDelete() {
  $q.dialog({
    title: '삭제 확인',
    message: '이 미디어 묶음을 전체 삭제할까요?',
    cancel: { label: '취소', flat: true },
    ok: { label: '삭제', color: 'negative' },
    dark: true,
  }).onOk(async () => {
    await mediaStore.deleteGroup(selectedGroup.value.id)
    selectedGroup.value = null
  })
}

function onGroupDeleted(groupId) {
  if (selectedGroup.value?.id === groupId) selectedGroup.value = null
}

function onSelectTagFromList(tag) {
  selectedTagId.value = tag.id
}
</script>
