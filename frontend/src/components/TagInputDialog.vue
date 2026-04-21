<template>
  <q-dialog v-model="show" position="bottom">
    <q-card class="bg-grey-9 full-width" style="border-radius:16px 16px 0 0">
      <q-card-section>
        <div class="text-subtitle2 text-grey-3 q-mb-sm">태그 편집</div>

        <!-- 현재 태그 목록 -->
        <div class="row q-gutter-xs q-mb-md">
          <q-chip
            v-for="tag in modelTags"
            :key="tag.id"
            removable
            color="grey-8"
            text-color="white"
            @remove="removeTag(tag)"
          >
            {{ tag.name }}
          </q-chip>
        </div>

        <!-- 태그 입력 -->
        <q-input
          v-model="inputText"
          dark outlined
          placeholder="태그 입력 후 Enter (쉼표로 구분 가능)"
          color="pink-5"
          @keyup.enter="addTags"
        >
          <template #append>
            <q-btn flat round icon="add" color="pink-5" @click="addTags" />
          </template>
        </q-input>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="취소" color="grey-5" v-close-popup />
        <q-btn unelevated label="저장" color="pink-6" @click="save" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useTagStore } from '../stores/tagStore'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialTags: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'save'])

const tagStore = useTagStore()
const show = ref(props.modelValue)
const modelTags = ref([...props.initialTags])
const inputText = ref('')

watch(() => props.modelValue, (v) => { show.value = v })
watch(show, (v) => emit('update:modelValue', v))
watch(() => props.initialTags, (v) => { modelTags.value = [...v] })

async function addTags() {
  const names = inputText.value.split(',').map((s) => s.trim()).filter(Boolean)
  for (const name of names) {
    const tag = await tagStore.findOrCreateTag(name)
    if (tag && !modelTags.value.find((t) => t.id === tag.id)) {
      modelTags.value.push(tag)
    }
  }
  inputText.value = ''
}

function removeTag(tag) {
  modelTags.value = modelTags.value.filter((t) => t.id !== tag.id)
}

function save() {
  emit('save', modelTags.value)
  show.value = false
}
</script>
