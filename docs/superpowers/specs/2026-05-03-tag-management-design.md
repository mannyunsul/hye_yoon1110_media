# Tag Management & Count Fix — Design Spec

## Summary

Fix broken tag count tracking and add tag deletion UI to TagListSheet.

## Bugs to Fix

### 1. `deleteGroup` (mediaStore.js)
현재 `DELETE FROM media_groups`만 실행. `PRAGMA foreign_keys` 꺼져 있어 CASCADE 미작동.

**Fix:**
1. 삭제 전 `group_tags`에서 연결된 tagId 조회
2. 각 tagId의 `count - 1` (MIN 0)
3. `group_tags` 수동 삭제
4. `media_items` 수동 삭제
5. `media_groups` 삭제

### 2. `onSaveTagEdit` (ManagePage.vue)
태그 편집 저장 시 count 변경 없음.

**Fix:**
- 기존 tagId set vs 새 tagId set 비교
- 제거된 태그: `count - 1`
- 추가된 태그: `count + 1`

## New Feature: Tag Deletion in TagListSheet

### tagStore — `deleteTag(tagId, count)` 액션 추가
1. `group_tags WHERE tagId = ?` 삭제
2. `tags WHERE id = ?` 삭제
3. `loadTags()`

### TagListSheet UI 변경
- 각 태그 행 우측에 휴지통 아이콘 버튼 추가
- **`tag.count === 0`**: 확인 없이 즉시 삭제
- **`tag.count > 0`**: 확인 다이얼로그 표시
  - 메시지: `"'[태그명]' 태그가 [N]개 항목에서 제거됩니다. 삭제할까요?"`
  - 버튼: 취소 / 삭제(negative)
- 삭제 후 태그 목록 갱신 (TagListSheet 내에서 처리)

## Scope

- tagStore.js: `deleteTag` 추가
- mediaStore.js: `deleteGroup` 수정
- ManagePage.vue: `onSaveTagEdit` 수정
- TagListSheet.vue: 삭제 버튼 + 확인 다이얼로그 추가
