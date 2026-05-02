<template>
  <q-dialog v-model="show" full-height position="right">
    <q-card class="bg-grey-9" style="width:280px;max-width:90vw">
      <q-card-section class="q-pb-xs">
        <div class="text-subtitle2 text-grey-3">태그 전체 목록</div>
      </q-card-section>

      <div class="q-px-md q-pb-sm">
        <q-input
          v-model="search"
          dark outlined dense
          placeholder="태그 검색"
          color="pink-5"
          clearable
        />
      </div>

      <div class="tag-list-wrap" style="position:relative;flex:1;display:flex">
        <q-scroll-area style="flex:1;height:calc(100vh - 160px)">
          <template v-for="(tags, cs) in filteredByChosung" :key="cs">
            <div class="chosung-header q-px-md q-py-xs text-grey-5" style="font-size:11px;font-weight:700;background:#1a1a1a">
              {{ cs }}
            </div>
            <q-item
              v-for="tag in tags"
              :key="tag.id"
              clickable dense
              @click="selectTag(tag)"
            >
              <q-item-section>
                <q-item-label class="text-grey-3" style="font-size:12px">{{ tag.name }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-xs">
                  <q-badge color="grey-8" :label="tag.count" />
                  <q-btn
                    flat round dense
                    icon="delete"
                    size="xs"
                    color="grey-6"
                    @click.stop="deleteTag(tag)"
                  />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </q-scroll-area>

        <div class="chosung-nav">
          <div
            v-for="cs in chosungList"
            :key="cs"
            class="chosung-item"
            :class="{ active: cs === activeChosung }"
            @click="activeChosung = cs"
          >
            {{ cs }}
          </div>
        </div>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useTagStore } from '../stores/tagStore'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'select'])

const $q = useQuasar()
const tagStore = useTagStore()
const show = ref(props.modelValue)
const search = ref('')
const activeChosung = ref('')

watch(() => props.modelValue, (v) => { show.value = v })
watch(show, (v) => emit('update:modelValue', v))

const chosungList = computed(() => Object.keys(tagStore.byChosung).sort())

const filteredByChosung = computed(() => {
  const q = search.value.trim()
  const grouped = tagStore.byChosung
  if (!q) return grouped
  const result = {}
  for (const [cs, tags] of Object.entries(grouped)) {
    const filtered = tags.filter((t) => t.name.includes(q))
    if (filtered.length) result[cs] = filtered
  }
  return result
})

function selectTag(tag) {
  emit('select', tag)
  show.value = false
}

async function deleteTag(tag) {
  if (tag.count === 0) {
    await tagStore.deleteTag(tag.id)
    return
  }
  $q.dialog({
    title: '태그 삭제',
    message: `'${tag.name}' 태그가 ${tag.count}개 항목에서 제거됩니다. 삭제할까요?`,
    cancel: { label: '취소', flat: true },
    ok: { label: '삭제', color: 'negative' },
    dark: true,
  }).onOk(async () => {
    await tagStore.deleteTag(tag.id)
  })
}
</script>

<style scoped>
.chosung-nav {
  width: 20px; display: flex; flex-direction: column;
  align-items: center; padding: 8px 0; gap: 2px;
}
.chosung-item { font-size: 9px; color: #666; cursor: pointer; line-height: 1.4; }
.chosung-item.active { color: #e91e8c; font-weight: 700; }
</style>
