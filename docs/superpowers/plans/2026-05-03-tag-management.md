# Tag Management & Count Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 태그 count가 그룹 삭제/태그 편집 시 올바르게 갱신되도록 버그 수정하고, TagListSheet에 태그 삭제 UI를 추가한다.

**Architecture:** 버그 3개(deleteGroup, onSaveTagEdit, deleteTag 미구현)를 순서대로 수정한다. tagStore에 deleteTag 액션을 추가하고, TagListSheet에서 useQuasar를 통해 확인 다이얼로그를 처리한다.

**Tech Stack:** Vue 3 Composition API, Pinia, Quasar, @capacitor-community/sqlite

---

## File Map

| 파일 | 변경 |
|------|------|
| `frontend/src/stores/tagStore.js` | `deleteTag(tagId, count)` 액션 추가 |
| `frontend/src/stores/mediaStore.js` | `deleteGroup` 수정 — tag count 감소 + 수동 cascade |
| `frontend/src/pages/ManagePage.vue` | `onSaveTagEdit` 수정 — count 증감 처리 |
| `frontend/src/components/TagListSheet.vue` | 삭제 버튼 + 확인 다이얼로그 추가 |

---

## Task 1: tagStore에 deleteTag 액션 추가

**Files:**
- Modify: `frontend/src/stores/tagStore.js`

- [ ] **Step 1: `deleteTag` 액션 추가**

`tagStore.js`의 `actions` 블록 마지막(`removeTagFromGroup` 아래)에 추가:

```js
async deleteTag(tagId) {
  const db = getDB();
  if (!db) return;
  await db.run('DELETE FROM group_tags WHERE tagId = ?', [tagId]);
  await db.run('DELETE FROM tags WHERE id = ?', [tagId]);
  await this.loadTags();
},
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/stores/tagStore.js
git commit -m "feat: add deleteTag action to tagStore"
```

---

## Task 2: deleteGroup 버그 수정

**Files:**
- Modify: `frontend/src/stores/mediaStore.js`

현재 코드는 `DELETE FROM media_groups`만 실행. `PRAGMA foreign_keys`가 꺼져 있어 CASCADE 미작동 → `group_tags`, `media_items` 고아 레코드 남음 + `tags.count` 미감소.

- [ ] **Step 1: `deleteGroup` 전체 교체**

`mediaStore.js`의 `deleteGroup` 메서드를 아래로 교체:

```js
async deleteGroup(groupId) {
  const db = getDB()
  if (!db) return

  // 연결된 태그 ID 조회 후 count 감소
  const tagResult = await db.query(
    'SELECT tagId FROM group_tags WHERE groupId = ?',
    [groupId]
  )
  const tagIds = (tagResult.values || []).map((r) => r.tagId)
  for (const tagId of tagIds) {
    await db.run(
      'UPDATE tags SET count = MAX(0, count - 1) WHERE id = ?',
      [tagId]
    )
  }

  // 수동 cascade (PRAGMA foreign_keys 꺼져 있으므로)
  await db.run('DELETE FROM group_tags WHERE groupId = ?', [groupId])
  await db.run('DELETE FROM media_items WHERE groupId = ?', [groupId])
  await db.run('DELETE FROM media_groups WHERE id = ?', [groupId])

  await this.loadGroups()
},
```

- [ ] **Step 2: 수동 검증**

앱에서:
1. 태그가 붙은 항목을 롱프레스 → 전체 삭제
2. 태그 목록 열기 → 해당 태그의 count가 1 감소했는지 확인
3. 모든 항목에서 해당 태그를 삭제했다면 count가 0이 되는지 확인

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/stores/mediaStore.js
git commit -m "fix: decrement tag counts and cascade delete on deleteGroup"
```

---

## Task 3: onSaveTagEdit 태그 count 수정

**Files:**
- Modify: `frontend/src/pages/ManagePage.vue`

현재 코드는 `group_tags`를 삭제 후 재삽입하지만 `tags.count`를 전혀 건드리지 않음.

- [ ] **Step 1: `onSaveTagEdit` 함수 전체 교체**

`ManagePage.vue`의 `onSaveTagEdit` 함수를 아래로 교체:

```js
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
```

- [ ] **Step 2: 수동 검증**

앱에서:
1. 태그가 붙은 항목을 롱프레스 → 태그 편집 → 태그 하나 제거 → 저장
2. 태그 목록에서 해당 태그 count가 1 감소했는지 확인
3. 새 태그 추가 후 저장 → 해당 태그 count 증가 확인

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/ManagePage.vue
git commit -m "fix: update tag counts when editing group tags"
```

---

## Task 4: TagListSheet에 태그 삭제 UI 추가

**Files:**
- Modify: `frontend/src/components/TagListSheet.vue`

- [ ] **Step 1: `<script setup>` 수정**

기존 script를 아래로 교체:

```vue
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

function deleteTag(tag) {
  if (tag.count === 0) {
    tagStore.deleteTag(tag.id)
    return
  }
  $q.dialog({
    title: '태그 삭제',
    message: `'${tag.name}' 태그가 ${tag.count}개 항목에서 제거됩니다. 삭제할까요?`,
    cancel: { label: '취소', flat: true },
    ok: { label: '삭제', color: 'negative' },
    dark: true,
  }).onOk(() => {
    tagStore.deleteTag(tag.id)
  })
}
</script>
```

- [ ] **Step 2: 태그 행에 삭제 버튼 추가**

`TagListSheet.vue` template의 `<q-item>` 블록을 아래로 교체:

```html
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
```

- [ ] **Step 3: 수동 검증**

앱에서:
1. 태그 목록 열기
2. count가 0인 태그의 삭제 버튼 탭 → 확인 없이 바로 삭제되는지 확인
3. count가 1 이상인 태그의 삭제 버튼 탭 → 확인 다이얼로그 표시되는지 확인
4. 확인 후 삭제 → 태그 목록에서 사라지는지 확인
5. 해당 태그가 붙어 있던 항목 열기 → 태그가 제거됐는지 확인

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/TagListSheet.vue
git commit -m "feat: add tag delete button with count-based confirmation to TagListSheet"
```
