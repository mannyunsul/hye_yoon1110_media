<template>
  <div class="tag-filter-bar">
    <div class="scroll-area">
      <q-chip
        clickable dense
        :color="modelValue === null ? 'pink-6' : 'grey-8'"
        text-color="white"
        label="전체"
        @click="$emit('update:modelValue', null)"
      />
      <q-chip
        v-for="tag in topTags"
        :key="tag.id"
        clickable dense
        :color="modelValue === tag.id ? 'pink-6' : 'grey-8'"
        text-color="white"
        :label="tag.name"
        @click="$emit('update:modelValue', tag.id)"
      />
      <q-chip
        clickable dense
        color="grey-9" text-color="pink-4"
        label="全"
        @click="$emit('open-all')"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTagStore } from '../stores/tagStore'

defineProps({
  modelValue: { type: String, default: null },
})
defineEmits(['update:modelValue', 'open-all'])

const tagStore = useTagStore()
const topTags = computed(() => tagStore.sortedByCount.slice(0, 10))
</script>

<style scoped>
.tag-filter-bar { padding: 4px 12px 8px; }
.scroll-area {
  display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;
  scrollbar-width: none;
}
.scroll-area::-webkit-scrollbar { display: none; }
</style>
