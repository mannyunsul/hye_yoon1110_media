<template>
  <q-bottom-sheet v-model="show" seamless>
    <q-card class="bg-grey-9" style="border-radius:20px 20px 0 0; max-height:75vh">
      <!-- 핸들 -->
      <div class="flex flex-center q-pt-sm q-pb-xs">
        <div style="width:36px;height:4px;background:#555;border-radius:2px" />
      </div>

      <!-- 미디어 영역 -->
      <div class="bg-grey-10 flex flex-center" style="height:200px;position:relative">
        <template v-if="currentItem">
          <q-img
            v-if="currentItem.type === 'image'"
            :src="currentItem.filePath || currentItem.remoteUrl"
            fit="contain"
            style="height:200px"
          />
          <video
            v-else-if="currentItem.type === 'video'"
            :src="currentItem.filePath || currentItem.remoteUrl"
            controls
            style="height:200px;max-width:100%"
          />
        </template>
        <q-icon v-else name="image" color="grey-7" size="48px" />

        <!-- 인덱스 표시 -->
        <div
          v-if="items.length > 1"
          class="absolute-top-right q-ma-sm"
          style="background:rgba(0,0,0,0.6);border-radius:8px;padding:2px 8px;font-size:11px;color:#fff"
        >
          {{ currentIndex + 1 }} / {{ items.length }}
        </div>

        <q-btn
          v-if="currentIndex > 0"
          flat round icon="chevron_left" color="white"
          class="absolute-left"
          @click="currentIndex--"
        />
        <q-btn
          v-if="currentIndex < items.length - 1"
          flat round icon="chevron_right" color="white"
          class="absolute-right"
          @click="currentIndex++"
        />
      </div>

      <!-- 인포 영역 -->
      <q-card-section class="q-py-sm">
        <div class="row items-center q-gutter-sm q-mb-sm">
          <platform-badge :platform="group.platform" />
          <a
            v-if="group.sourceUrl"
            :href="group.sourceUrl"
            target="_blank"
            class="text-pink-5"
            style="font-size:11px"
          >
            {{ shortUrl }} ↗
          </a>
        </div>

        <div class="row q-gutter-xs q-mb-sm">
          <q-chip
            v-for="tag in tags"
            :key="tag.id"
            dense removable
            color="grey-8" text-color="white"
            style="font-size:10px"
            @remove="onRemoveTag(tag)"
          >
            {{ tag.name }}
          </q-chip>
          <q-chip
            dense clickable
            color="pink-9" text-color="pink-3"
            icon="add" label="태그"
            style="font-size:10px"
            @click="showTagDialog = true"
          />
        </div>

        <q-btn
          flat full-width
          icon="delete_outline" label="이 사진/영상만 삭제"
          color="red-4"
          style="font-size:11px"
          @click="onDeleteItem"
        />
      </q-card-section>
    </q-card>
  </q-bottom-sheet>

  <tag-input-dialog
    v-model="showTagDialog"
    :initial-tags="tags"
    @save="onSaveTags"
  />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import PlatformBadge from './PlatformBadge.vue'
import TagInputDialog from './TagInputDialog.vue'
import { useMediaStore } from '../stores/mediaStore'
import { useTagStore } from '../stores/tagStore'
import { getDB } from '../stores/db'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  group: { type: Object, required: true },
})
const emit = defineEmits(['update:modelValue', 'deleted'])

const mediaStore = useMediaStore()
const tagStore = useTagStore()

const show = ref(props.modelValue)
const items = ref([])
const currentIndex = ref(0)
const tags = ref([])
const showTagDialog = ref(false)

watch(() => props.modelValue, (v) => { show.value = v })
watch(show, (v) => emit('update:modelValue', v))

watch(() => props.group, async (g) => {
  if (!g) return
  currentIndex.value = 0
  items.value = await mediaStore.getItemsByGroup(g.id)
  tags.value = await tagStore.getTagsByGroup(g.id)
}, { immediate: true })

const currentItem = computed(() => items.value[currentIndex.value] || null)
const shortUrl = computed(() => {
  if (!props.group?.sourceUrl) return ''
  try {
    const u = new URL(props.group.sourceUrl)
    return u.hostname + u.pathname.slice(0, 20) + (u.pathname.length > 20 ? '...' : '')
  } catch { return props.group.sourceUrl.slice(0, 30) }
})

async function onRemoveTag(tag) {
  await tagStore.removeTagFromGroup(props.group.id, tag.id)
  tags.value = await tagStore.getTagsByGroup(props.group.id)
}

async function onSaveTags(newTags) {
  const db = getDB()
  await db.run('DELETE FROM group_tags WHERE groupId = ?', [props.group.id])
  for (const tag of newTags) {
    await db.run(
      'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
      [props.group.id, tag.id]
    )
  }
  await tagStore.loadTags()
  tags.value = await tagStore.getTagsByGroup(props.group.id)
}

async function onDeleteItem() {
  if (!currentItem.value) return
  await mediaStore.deleteItem(currentItem.value.id, props.group.id)
  if (mediaStore.groups.find((g) => g.id === props.group.id)) {
    items.value = await mediaStore.getItemsByGroup(props.group.id)
    currentIndex.value = Math.min(currentIndex.value, items.value.length - 1)
  } else {
    show.value = false
    emit('deleted', props.group.id)
  }
}
</script>
