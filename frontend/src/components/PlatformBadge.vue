<template>
  <q-badge
    :color="color"
    :label="label"
    class="platform-badge"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  platform: { type: String, required: true },
})

const PLATFORM_MAP = {
  instagram: { label: 'IG', color: 'pink-7' },
  x:         { label: 'X',  color: 'blue-grey-7' },
  tiktok:    { label: 'TT', color: 'red-7' },
  youtube:   { label: 'YT', color: 'red-8' },
  facebook:  { label: 'FB', color: 'blue-8' },
  camera:    { label: '📷', color: 'grey-7' },
  other:     { label: '?',  color: 'grey-8' },
}

const info = computed(() => PLATFORM_MAP[props.platform] || PLATFORM_MAP.other)
const label = computed(() => info.value.label)
const color = computed(() => info.value.color)
</script>

<style scoped>
.platform-badge { font-size: 9px; padding: 2px 5px; }
</style>
