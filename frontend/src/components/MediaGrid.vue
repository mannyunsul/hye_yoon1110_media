<template>
  <div class="media-grid">
    <div
      v-for="group in groups"
      :key="group.id"
      class="grid-item"
      @click="$emit('tap', group)"
      v-touch-hold.mouse="() => $emit('longpress', group)"
    >
      <!-- 썸네일 -->
      <q-img
        v-if="group.thumbnailPath"
        :src="group.thumbnailPath"
        class="full-width full-height"
        fit="cover"
      />
      <div v-else class="no-thumb flex flex-center">
        <q-icon name="image" color="grey-7" size="32px" />
      </div>

      <!-- 플랫폼 뱃지 -->
      <platform-badge
        :platform="group.platform"
        class="absolute-top-left q-ma-xs"
      />

      <!-- 북마크 뱃지 -->
      <q-badge
        v-if="group.mode === 'bookmark'"
        color="purple-8"
        label="🔖"
        class="absolute-top-right q-ma-xs"
      />

      <!-- carousel 개수 뱃지 -->
      <q-badge
        v-if="group.totalCount > 1"
        color="dark"
        :label="`🖼️ 1/${group.totalCount}`"
        class="absolute-bottom-right q-ma-xs"
        style="font-size:8px"
      />
    </div>
  </div>
</template>

<script setup>
import PlatformBadge from './PlatformBadge.vue'

defineProps({
  groups: { type: Array, default: () => [] },
})
defineEmits(['tap', 'longpress'])
</script>

<style scoped>
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.grid-item {
  aspect-ratio: 1;
  background: #2a2a2a;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.no-thumb {
  width: 100%;
  height: 100%;
  background: #2a2a2a;
}
</style>
