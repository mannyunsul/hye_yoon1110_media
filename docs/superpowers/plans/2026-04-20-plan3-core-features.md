# Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 탭3(다운로드), 탭1(관리 목록 + 바텀 시트 + 롱프레스), 탭2(미관리 목록)의 핵심 기능을 구현한다.

**Architecture:** 각 탭은 독립적인 Page 컴포넌트로 구현된다. 공통 UI(바텀 시트, 태그 입력 다이얼로그)는 재사용 가능한 컴포넌트로 분리한다. 미디어 다운로드는 Capacitor Filesystem API로 갤러리에 저장하고, 갤러리 스캔은 @capacitor/media 플러그인을 사용한다.

**Tech Stack:** Vue 3 Composition API, Quasar components (QBottomSheet, QDialog, QInfiniteScroll), @capacitor/filesystem, @capacitor/media, axios

**전제 조건:** Plan 1 (백엔드) + Plan 2 (앱 기반) 완료

---

## File Structure

```
frontend/src/
├── pages/
│   ├── ManagePage.vue          # 탭1: 관리 목록 전체
│   ├── UnmanagedPage.vue       # 탭2: 미관리 목록 전체
│   └── DownloadPage.vue        # 탭3: 다운로드 전체
├── components/
│   ├── MediaGrid.vue           # 재사용 갤러리 그리드
│   ├── MediaBottomSheet.vue    # 바텀 시트 (carousel + 태그 + 삭제)
│   ├── TagFilterBar.vue        # 가로 스크롤 태그 필터바
│   ├── TagInputDialog.vue      # 태그 입력/편집 다이얼로그
│   ├── TagListSheet.vue        # 전체 태그 목록 (초성 바로가기)
│   └── PlatformBadge.vue       # 플랫폼 뱃지 컴포넌트
└── composables/
    ├── useDownload.js           # 다운로드/북마크 로직
    └── useGalleryScan.js        # 갤러리 스캔 로직
```

---

## Task 1: 공통 컴포넌트 — PlatformBadge + MediaGrid

**Files:**
- Create: `frontend/src/components/PlatformBadge.vue`
- Create: `frontend/src/components/MediaGrid.vue`

- [ ] **Step 1: PlatformBadge.vue 작성**

```vue
<template>
  <q-badge
    :color="color"
    :label="label"
    class="platform-badge"
  />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  platform: { type: String, required: true },
});

const PLATFORM_MAP = {
  instagram: { label: 'IG', color: 'pink-7' },
  x:         { label: 'X',  color: 'blue-grey-7' },
  tiktok:    { label: 'TT', color: 'red-7' },
  youtube:   { label: 'YT', color: 'red-8' },
  facebook:  { label: 'FB', color: 'blue-8' },
  camera:    { label: '📷', color: 'grey-7' },
  other:     { label: '?',  color: 'grey-8' },
};

const info = computed(() => PLATFORM_MAP[props.platform] || PLATFORM_MAP.other);
const label = computed(() => info.value.label);
const color = computed(() => info.value.color);
</script>

<style scoped>
.platform-badge { font-size: 9px; padding: 2px 5px; }
</style>
```

- [ ] **Step 2: MediaGrid.vue 작성**

```vue
<template>
  <div class="media-grid">
    <div
      v-for="group in groups"
      :key="group.id"
      class="grid-item"
      @click="$emit('tap', group)"
      @long-press="$emit('longpress', group)"
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
import PlatformBadge from './PlatformBadge.vue';

defineProps({
  groups: { type: Array, default: () => [] },
});
defineEmits(['tap', 'longpress']);
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
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/PlatformBadge.vue frontend/src/components/MediaGrid.vue
git commit -m "feat: add PlatformBadge and MediaGrid components"
```

---

## Task 2: 태그 입력 다이얼로그

**Files:**
- Create: `frontend/src/components/TagInputDialog.vue`

- [ ] **Step 1: TagInputDialog.vue 작성**

```vue
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
import { ref, watch } from 'vue';
import { useTagStore } from '../stores/tagStore';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialTags: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'save']);

const tagStore = useTagStore();
const show = ref(props.modelValue);
const modelTags = ref([...props.initialTags]);
const inputText = ref('');

watch(() => props.modelValue, (v) => { show.value = v; });
watch(show, (v) => emit('update:modelValue', v));
watch(() => props.initialTags, (v) => { modelTags.value = [...v]; });

async function addTags() {
  const names = inputText.value.split(',').map((s) => s.trim()).filter(Boolean);
  for (const name of names) {
    const tag = await tagStore.findOrCreateTag(name);
    if (tag && !modelTags.value.find((t) => t.id === tag.id)) {
      modelTags.value.push(tag);
    }
  }
  inputText.value = '';
}

function removeTag(tag) {
  modelTags.value = modelTags.value.filter((t) => t.id !== tag.id);
}

function save() {
  emit('save', modelTags.value);
  show.value = false;
}
</script>
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/TagInputDialog.vue
git commit -m "feat: add TagInputDialog component"
```

---

## Task 3: 바텀 시트 컴포넌트

**Files:**
- Create: `frontend/src/components/MediaBottomSheet.vue`

- [ ] **Step 1: MediaBottomSheet.vue 작성**

```vue
<template>
  <q-bottom-sheet v-model="show" seamless>
    <q-card class="bg-grey-9" style="border-radius:20px 20px 0 0; max-height:75vh">
      <!-- 핸들 -->
      <div class="flex flex-center q-pt-sm q-pb-xs">
        <div style="width:36px;height:4px;background:#555;border-radius:2px" />
      </div>

      <!-- 미디어 영역 -->
      <div class="media-area bg-grey-10 flex flex-center" style="height:200px;position:relative">
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

        <!-- 이전/다음 버튼 -->
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
        <!-- 플랫폼 + 출처 URL -->
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

        <!-- 태그 -->
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

        <!-- 현재 미디어만 삭제 -->
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
import { ref, computed, watch } from 'vue';
import PlatformBadge from './PlatformBadge.vue';
import TagInputDialog from './TagInputDialog.vue';
import { useMediaStore } from '../stores/mediaStore';
import { useTagStore } from '../stores/tagStore';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  group: { type: Object, required: true },
});
const emit = defineEmits(['update:modelValue', 'deleted']);

const mediaStore = useMediaStore();
const tagStore = useTagStore();

const show = ref(props.modelValue);
const items = ref([]);
const currentIndex = ref(0);
const tags = ref([]);
const showTagDialog = ref(false);

watch(() => props.modelValue, (v) => { show.value = v; });
watch(show, (v) => emit('update:modelValue', v));

watch(() => props.group, async (g) => {
  if (!g) return;
  currentIndex.value = 0;
  items.value = await mediaStore.getItemsByGroup(g.id);
  tags.value = await tagStore.getTagsByGroup(g.id);
}, { immediate: true });

const currentItem = computed(() => items.value[currentIndex.value] || null);
const shortUrl = computed(() => {
  if (!props.group?.sourceUrl) return '';
  try {
    const u = new URL(props.group.sourceUrl);
    return u.hostname + u.pathname.slice(0, 20) + (u.pathname.length > 20 ? '...' : '');
  } catch { return props.group.sourceUrl.slice(0, 30); }
});

async function onRemoveTag(tag) {
  await tagStore.removeTagFromGroup(props.group.id, tag.id);
  tags.value = await tagStore.getTagsByGroup(props.group.id);
}

async function onSaveTags(newTags) {
  const db = (await import('../stores/db')).getDB();
  // 기존 태그 전부 제거 후 새 태그 등록
  await db.run('DELETE FROM group_tags WHERE groupId = ?', [props.group.id]);
  for (const tag of newTags) {
    await db.run(
      'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
      [props.group.id, tag.id]
    );
  }
  await tagStore.loadTags();
  tags.value = await tagStore.getTagsByGroup(props.group.id);
}

async function onDeleteItem() {
  if (!currentItem.value) return;
  await mediaStore.deleteItem(currentItem.value.id, props.group.id);
  // 그룹이 삭제됐으면 바텀 시트 닫기
  if (mediaStore.groups.find((g) => g.id === props.group.id)) {
    items.value = await mediaStore.getItemsByGroup(props.group.id);
    currentIndex.value = Math.min(currentIndex.value, items.value.length - 1);
  } else {
    show.value = false;
    emit('deleted', props.group.id);
  }
}
</script>
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/MediaBottomSheet.vue
git commit -m "feat: add MediaBottomSheet with carousel and tag management"
```

---

## Task 4: 태그 필터바 + 전체 목록 시트

**Files:**
- Create: `frontend/src/components/TagFilterBar.vue`
- Create: `frontend/src/components/TagListSheet.vue`

- [ ] **Step 1: TagFilterBar.vue 작성**

```vue
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
import { computed } from 'vue';
import { useTagStore } from '../stores/tagStore';

defineProps({
  modelValue: { type: String, default: null },
});
defineEmits(['update:modelValue', 'open-all']);

const tagStore = useTagStore();
const topTags = computed(() => tagStore.sortedByCount.slice(0, 10));
</script>

<style scoped>
.tag-filter-bar { padding: 4px 12px 8px; }
.scroll-area {
  display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;
  scrollbar-width: none;
}
.scroll-area::-webkit-scrollbar { display: none; }
</style>
```

- [ ] **Step 2: TagListSheet.vue 작성**

```vue
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
        <!-- 태그 목록 -->
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
                <q-badge color="grey-8" :label="tag.count" />
              </q-item-section>
            </q-item>
          </template>
        </q-scroll-area>

        <!-- 초성 바로가기 -->
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
import { ref, computed, watch } from 'vue';
import { useTagStore } from '../stores/tagStore';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'select']);

const tagStore = useTagStore();
const show = ref(props.modelValue);
const search = ref('');
const activeChosung = ref('');

watch(() => props.modelValue, (v) => { show.value = v; });
watch(show, (v) => emit('update:modelValue', v));

const chosungList = computed(() => Object.keys(tagStore.byChosung).sort());

const filteredByChosung = computed(() => {
  const q = search.value.trim();
  const grouped = tagStore.byChosung;
  if (!q) return grouped;
  const result = {};
  for (const [cs, tags] of Object.entries(grouped)) {
    const filtered = tags.filter((t) => t.name.includes(q));
    if (filtered.length) result[cs] = filtered;
  }
  return result;
});

function selectTag(tag) {
  emit('select', tag);
  show.value = false;
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
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/TagFilterBar.vue frontend/src/components/TagListSheet.vue
git commit -m "feat: add TagFilterBar and TagListSheet with chosung navigation"
```

---

## Task 5: 탭1 — 관리 목록 페이지

**Files:**
- Modify: `frontend/src/pages/ManagePage.vue`

- [ ] **Step 1: ManagePage.vue 작성**

```vue
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
    <div class="platform-filter row q-px-md q-gutter-xs q-mb-sm">
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
import { ref, computed, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import MediaGrid from '../components/MediaGrid.vue';
import MediaBottomSheet from '../components/MediaBottomSheet.vue';
import TagFilterBar from '../components/TagFilterBar.vue';
import TagInputDialog from '../components/TagInputDialog.vue';
import TagListSheet from '../components/TagListSheet.vue';
import { useMediaStore } from '../stores/mediaStore';
import { useTagStore } from '../stores/tagStore';
import { getDB } from '../stores/db';

const $q = useQuasar();
const mediaStore = useMediaStore();
const tagStore = useTagStore();

const search = ref('');
const selectedTagId = ref(null);
const selectedPlatform = ref('all');
const showBottomSheet = ref(false);
const showLongpress = ref(false);
const showTagEdit = ref(false);
const showTagList = ref(false);
const selectedGroup = ref(null);
const selectedGroupTags = ref([]);

const platforms = [
  { value: 'all', label: '전체' },
  { value: 'instagram', label: '📸 IG' },
  { value: 'x', label: '✖ X' },
  { value: 'tiktok', label: '🎵 TT' },
  { value: 'youtube', label: '▶ YT' },
];

onMounted(async () => {
  await mediaStore.loadGroups();
  await tagStore.loadTags();
});

const filteredGroups = computed(() => {
  let groups = mediaStore.groups;

  if (selectedPlatform.value !== 'all') {
    groups = groups.filter((g) => g.platform === selectedPlatform.value);
  }

  if (selectedTagId.value) {
    // 태그별 필터는 group_tags 조인이 필요 — 간단히 메모리 필터
    groups = groups.filter((g) => g._tagIds?.includes(selectedTagId.value));
  }

  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    groups = groups.filter(
      (g) =>
        g.sourceUrl?.toLowerCase().includes(q) ||
        g._tagNames?.some((n) => n.includes(q))
    );
  }

  return groups;
});

function openBottomSheet(group) {
  selectedGroup.value = group;
  showBottomSheet.value = true;
}

async function openLongpress(group) {
  selectedGroup.value = group;
  selectedGroupTags.value = await tagStore.getTagsByGroup(group.id);
  showLongpress.value = true;
}

function openSourceUrl() {
  if (selectedGroup.value?.sourceUrl) {
    window.open(selectedGroup.value.sourceUrl, '_blank');
  }
}

function openTagEdit() {
  showTagEdit.value = true;
}

async function onSaveTagEdit(newTags) {
  const db = getDB();
  await db.run('DELETE FROM group_tags WHERE groupId = ?', [selectedGroup.value.id]);
  for (const tag of newTags) {
    await db.run(
      'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
      [selectedGroup.value.id, tag.id]
    );
  }
  await tagStore.loadTags();
}

function confirmDelete() {
  $q.dialog({
    title: '삭제 확인',
    message: '이 미디어 묶음을 전체 삭제할까요?',
    cancel: { label: '취소', flat: true },
    ok: { label: '삭제', color: 'negative' },
    dark: true,
  }).onOk(async () => {
    await mediaStore.deleteGroup(selectedGroup.value.id);
    selectedGroup.value = null;
  });
}

function onGroupDeleted(groupId) {
  if (selectedGroup.value?.id === groupId) selectedGroup.value = null;
}

function onSelectTagFromList(tag) {
  selectedTagId.value = tag.id;
}
</script>
```

- [ ] **Step 2: 앱에서 관리 탭 확인**

```bash
quasar dev
```
예상 결과: 관리 탭에 검색창, 태그 필터바, 플랫폼 필터, 빈 그리드 표시

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/ManagePage.vue
git commit -m "feat: implement ManagePage with filters and bottom sheet"
```

---

## Task 6: composable — useDownload

**Files:**
- Create: `frontend/src/composables/useDownload.js`

- [ ] **Step 1: Filesystem 플러그인 설치**

```bash
npm install @capacitor/filesystem
npx cap sync
```

- [ ] **Step 2: useDownload.js 작성**

```javascript
// src/composables/useDownload.js
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';
import { useSettingsStore } from '../stores/settingsStore';

export function useDownload() {
  const settingsStore = useSettingsStore();

  async function fetchMediaInfo(url) {
    const backendUrl = settingsStore.backendUrl;
    if (!backendUrl) throw new Error('백엔드 URL이 설정되지 않았습니다.');

    const { data } = await axios.post(`${backendUrl}/api/fetch`, { url }, { timeout: 30000 });
    if (!data.success) throw new Error(data.message || '미디어 추출 실패');
    return data; // { platform, sourceUrl, media: [{url, type, index}] }
  }

  async function downloadFile(remoteUrl, filename) {
    if (!Capacitor.isNativePlatform()) {
      console.warn('파일 저장은 네이티브 환경에서만 동작합니다.');
      return null;
    }

    const response = await axios.get(remoteUrl, { responseType: 'blob' });
    const blob = response.data;

    const base64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({
      path: `MediaManager/${filename}`,
      data: base64,
      directory: Directory.External,
      recursive: true,
    });

    return result.uri;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function generateFilename(type, index) {
    const ts = Date.now();
    const ext = type === 'video' ? 'mp4' : 'jpg';
    return `media_${ts}_${index}.${ext}`;
  }

  return { fetchMediaInfo, downloadFile, generateFilename };
}
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/composables/useDownload.js
git commit -m "feat: add useDownload composable for media fetch and save"
```

---

## Task 7: 탭3 — 다운로드 페이지

**Files:**
- Modify: `frontend/src/pages/DownloadPage.vue`

- [ ] **Step 1: DownloadPage.vue 작성**

```vue
<template>
  <q-page class="bg-grey-10 q-pa-md">
    <div class="text-h6 text-grey-3 q-mb-md">⬇️ 다운로드</div>

    <!-- 모드 선택 -->
    <div class="mode-toggle row q-mb-md" style="background:#1e1e1e;border-radius:10px;padding:3px;gap:3px">
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
      <!-- carousel 미리보기 -->
      <div class="preview-carousel bg-grey-10 flex flex-center" style="height:140px;position:relative">
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
        <!-- 플랫폼 + 개수 -->
        <div class="row items-center q-gutter-sm q-mb-sm">
          <platform-badge :platform="result.platform" />
          <span class="text-caption text-grey-5">{{ result.media.length }}개 미디어</span>
        </div>

        <!-- 태그 입력 -->
        <q-input
          v-model="tagInput"
          dark outlined dense
          placeholder="태그 입력 (쉼표로 구분)"
          color="pink-5"
          class="q-mb-sm"
        />

        <!-- 저장 버튼 -->
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
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import PlatformBadge from '../components/PlatformBadge.vue';
import { useDownload } from '../composables/useDownload';
import { useMediaStore } from '../stores/mediaStore';
import { useTagStore } from '../stores/tagStore';

const $q = useQuasar();
const { fetchMediaInfo, downloadFile, generateFilename } = useDownload();
const mediaStore = useMediaStore();
const tagStore = useTagStore();

const modes = [
  { value: 'download', label: '⬇️ 다운로드' },
  { value: 'bookmark', label: '🔖 북마크' },
];

const mode = ref('download');
const inputUrl = ref('');
const loading = ref(false);
const saving = ref(false);
const result = ref(null);
const previewIndex = ref(0);
const tagInput = ref('');

async function onFetch() {
  loading.value = true;
  result.value = null;
  previewIndex.value = 0;
  try {
    result.value = await fetchMediaInfo(inputUrl.value.trim());
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message });
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  if (!result.value) return;
  saving.value = true;
  try {
    // 태그 처리
    const tagNames = tagInput.value.split(',').map((s) => s.trim()).filter(Boolean);
    const tagObjs = [];
    for (const name of tagNames) {
      const tag = await tagStore.findOrCreateTag(name);
      if (tag) tagObjs.push(tag);
    }

    const items = [];
    let thumbnailPath = null;

    if (mode.value === 'download') {
      // 전체 파일 다운로드
      for (let i = 0; i < result.value.media.length; i++) {
        const m = result.value.media[i];
        const filename = generateFilename(m.type, i);
        const filePath = await downloadFile(m.url, filename);
        if (i === 0) thumbnailPath = filePath;
        items.push({ filePath, remoteUrl: null, type: m.type });
      }
    } else {
      // 북마크: 첫 번째 썸네일만 다운로드
      const first = result.value.media[0];
      if (first) {
        const filename = generateFilename(first.type, 0);
        thumbnailPath = await downloadFile(first.url, filename);
      }
      for (const m of result.value.media) {
        items.push({ filePath: null, remoteUrl: m.url, type: m.type });
      }
    }

    await mediaStore.addGroup({
      sourceUrl: result.value.sourceUrl,
      platform: result.value.platform,
      mode: mode.value,
      thumbnailPath,
      items,
      tagIds: tagObjs.map((t) => t.id),
    });

    $q.notify({ type: 'positive', message: '등록 완료!' });
    result.value = null;
    inputUrl.value = '';
    tagInput.value = '';
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message });
  } finally {
    saving.value = false;
  }
}
</script>
```

- [ ] **Step 2: 브라우저에서 동작 확인 (백엔드 URL 설정 후)**

설정 탭에서 Railway URL 입력 후 다운로드 탭에서 공개 SNS URL 테스트.  
예상 결과: 미디어 미리보기 표시, 태그 입력 가능

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/DownloadPage.vue
git commit -m "feat: implement DownloadPage with download and bookmark modes"
```

---

## Task 8: composable — useGalleryScan + 탭2 미관리 목록

**Files:**
- Create: `frontend/src/composables/useGalleryScan.js`
- Modify: `frontend/src/pages/UnmanagedPage.vue`

- [ ] **Step 1: @capacitor/media 설치**

```bash
npm install @capacitor/media
npx cap sync
```

- [ ] **Step 2: useGalleryScan.js 작성**

```javascript
// src/composables/useGalleryScan.js
import { Capacitor } from '@capacitor/core';
import { getDB } from '../stores/db';

export function useGalleryScan() {
  async function scanUnmanaged() {
    if (!Capacitor.isNativePlatform()) return [];

    const db = getDB();
    if (!db) return [];

    // 등록된 파일 경로 목록
    const registered = await db.query('SELECT filePath FROM media_items WHERE filePath IS NOT NULL');
    const registeredPaths = new Set((registered.values || []).map((r) => r.filePath));

    // 갤러리 파일 목록 (Android: MediaStore)
    // @capacitor/media는 getMedias() API 제공
    const { Media } = await import('@capacitor/media');
    const { medias } = await Media.getMedias({ types: 'all', thumbnailWidth: 200, thumbnailHeight: 200 });

    return medias.filter((m) => !registeredPaths.has(m.identifier));
  }

  return { scanUnmanaged };
}
```

- [ ] **Step 3: UnmanagedPage.vue 작성**

```vue
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
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import TagInputDialog from '../components/TagInputDialog.vue';
import { useGalleryScan } from '../composables/useGalleryScan';
import { useMediaStore } from '../stores/mediaStore';
import { useTagStore } from '../stores/tagStore';

const $q = useQuasar();
const { scanUnmanaged } = useGalleryScan();
const mediaStore = useMediaStore();
const tagStore = useTagStore();

const unmanagedItems = ref([]);
const selected = ref([]);
const loading = ref(false);
const showTagDialog = ref(false);

onMounted(async () => {
  loading.value = true;
  unmanagedItems.value = await scanUnmanaged();
  loading.value = false;
});

function toggleSelect(item) {
  const idx = selected.value.indexOf(item.identifier);
  if (idx >= 0) selected.value.splice(idx, 1);
  else selected.value.push(item.identifier);
}

async function onRegister(tags) {
  const tagIds = tags.map((t) => t.id);
  for (const identifier of selected.value) {
    const item = unmanagedItems.value.find((i) => i.identifier === identifier);
    if (!item) continue;
    await mediaStore.addGroup({
      sourceUrl: null,
      platform: 'camera',
      mode: 'gallery',
      thumbnailPath: item.thumbnailUri || item.identifier,
      items: [{ filePath: item.identifier, remoteUrl: null, type: item.mediaType === 'video' ? 'video' : 'image' }],
      tagIds,
    });
  }
  selected.value = [];
  unmanagedItems.value = await scanUnmanaged();
  $q.notify({ type: 'positive', message: '등록 완료!' });
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
```

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/composables/useGalleryScan.js frontend/src/pages/UnmanagedPage.vue
git commit -m "feat: implement UnmanagedPage with gallery scan and tag registration"
```

---

## 완료 기준

- [ ] 관리 탭: 그리드 표시, 탭 시 바텀 시트 열림, 롱프레스 메뉴 동작
- [ ] 바텀 시트: carousel 스와이프, 출처 URL 클릭, 태그 추가/삭제, 개별 삭제
- [ ] 다운로드 탭: URL 입력 → 미리보기 → 태그 입력 → 저장 (다운로드 모드)
- [ ] 북마크 모드: 첫 썸네일만 저장, 나머지 remoteUrl로 등록
- [ ] 미관리 탭: 갤러리 스캔 → 다중 선택 → 태그 등록 → 관리 탭으로 이동
- [ ] 태그 필터바: 탭별 필터링 동작
- [ ] 전체 태그 목록: 초성별 섹션 + 바로가기 동작
