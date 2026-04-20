# App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quasar + Capacitor 모바일 앱 프로젝트를 생성하고, SQLite 데이터베이스 스키마와 Pinia 스토어, 하단 탭 내비게이션을 구성한다.

**Architecture:** Quasar CLI로 Vue 3 + Capacitor 프로젝트를 생성하고, 4개의 탭(관리/미관리/다운로드/설정)으로 구성된 레이아웃을 만든다. SQLite는 @capacitor-community/sqlite 플러그인으로 로컬 DB를 관리하며, Pinia 스토어가 DB 접근을 캡슐화한다.

**Tech Stack:** Quasar 2, Vue 3, Capacitor 5, @capacitor-community/sqlite, Pinia, Android Studio (안드로이드 빌드)

**전제 조건:** Plan 1 백엔드 배포 완료 및 Railway URL 확보

---

## File Structure

```
hye_yoon1110/
└── frontend/
    ├── package.json
    ├── quasar.config.js          # Quasar 설정, Capacitor 플러그인 등록
    ├── capacitor.config.json     # Capacitor 앱 ID, 앱 이름
    ├── src/
    │   ├── main.js               # Vue 앱 진입점
    │   ├── App.vue               # 루트 컴포넌트
    │   ├── router/
    │   │   └── index.js          # 탭별 라우트 정의
    │   ├── layouts/
    │   │   └── MainLayout.vue    # 하단 탭바 레이아웃
    │   ├── pages/
    │   │   ├── ManagePage.vue    # 탭1: 관리 목록 (빈 껍데기)
    │   │   ├── UnmanagedPage.vue # 탭2: 미관리 목록 (빈 껍데기)
    │   │   ├── DownloadPage.vue  # 탭3: 다운로드 (빈 껍데기)
    │   │   └── SettingsPage.vue  # 탭4: 설정 (빈 껍데기)
    │   ├── stores/
    │   │   ├── db.js             # SQLite 연결 및 초기화
    │   │   ├── mediaStore.js     # media_groups / media_items CRUD
    │   │   ├── tagStore.js       # tags / group_tags CRUD
    │   │   └── settingsStore.js  # OneDrive 연결 상태 등 설정값 (localStorage)
    │   └── config.js             # 백엔드 URL 등 하드코딩 설정값
    │   └── css/
    │       └── app.scss          # 전역 스타일 (다크 테마)
    └── src-capacitor/
        └── android/              # Capacitor Android 프로젝트 (자동 생성)
```

---

## Task 1: Quasar 프로젝트 생성

**Files:**
- Create: `frontend/` (전체 폴더)

- [ ] **Step 1: Quasar CLI 설치 확인**

```bash
npm i -g @quasar/cli
quasar --version
```
예상 출력: `2.x.x`

- [ ] **Step 2: Quasar 프로젝트 생성**

```bash
cd C:/work/myeon/workspace/hye_yoon1110
npm init quasar
```

대화형 질문에 아래와 같이 답변:
```
? What would you like to build? › App with Quasar CLI
? Project folder: › frontend
? Pick Quasar version: › Quasar v2 (Vue 3)
? Pick script type: › Javascript
? Pick Quasar App CLI variant: › Quasar App CLI with Vite
? Package name: › hye-yoon-media
? Project product name: › Media Manager
? Pick a CSS preprocessor: › Sass with SCSS syntax
? Check the features needed for your project: › Pinia, Capacitor
? Pick an Capacitor mode: › Capacitor
? Choose Capacitor target: › Android
? Install project dependencies? › Yes, use npm
```

- [ ] **Step 3: 생성 확인**

```bash
ls C:/work/myeon/workspace/hye_yoon1110/frontend/src/
```
예상 출력: `App.vue  css  layouts  pages  router  stores  main.js` 등

- [ ] **Step 4: 개발 서버 실행 확인**

```bash
cd C:/work/myeon/workspace/hye_yoon1110/frontend
quasar dev
```
예상 결과: 브라우저에서 `http://localhost:9000` 열림, Quasar 기본 화면 표시

- [ ] **Step 5: 커밋**

```bash
cd C:/work/myeon/workspace/hye_yoon1110
git add frontend/
git commit -m "feat: initialize Quasar + Capacitor project"
```

---

## Task 2: SQLite 플러그인 설치 및 초기화

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/stores/db.js`

- [ ] **Step 1: SQLite 플러그인 설치**

```bash
cd C:/work/myeon/workspace/hye_yoon1110/frontend
npm install @capacitor-community/sqlite
npx cap sync
```

- [ ] **Step 2: db.js 작성 — DB 연결 및 스키마 초기화**

```javascript
// src/stores/db.js
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db = null;

const DB_NAME = 'hyeyoon_media';
const DB_VERSION = 1;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS media_groups (
  id TEXT PRIMARY KEY,
  sourceUrl TEXT,
  platform TEXT NOT NULL,
  mode TEXT NOT NULL,
  thumbnailPath TEXT,
  totalCount INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  registeredAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  filePath TEXT,
  remoteUrl TEXT,
  type TEXT NOT NULL,
  itemIndex INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (groupId) REFERENCES media_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_tags (
  groupId TEXT NOT NULL,
  tagId TEXT NOT NULL,
  PRIMARY KEY (groupId, tagId),
  FOREIGN KEY (groupId) REFERENCES media_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
);
`;

export async function initDB() {
  if (db) return db;

  if (Capacitor.isNativePlatform()) {
    await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    if (isConn) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
    }
  } else {
    // 웹 개발 환경에서는 jeep-sqlite 필요 (선택 사항)
    console.warn('SQLite는 네이티브 환경에서만 동작합니다.');
    return null;
  }

  await db.open();
  await db.execute(CREATE_TABLES_SQL);
  return db;
}

export function getDB() {
  return db;
}
```

- [ ] **Step 3: quasar.config.js에서 Capacitor 플러그인 등록 확인**

`frontend/quasar.config.js`에서 capacitor 설정 섹션이 있는지 확인:
```javascript
capacitor: {
  hideSplashscreen: true,
}
```

없으면 추가.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/stores/db.js frontend/quasar.config.js
git commit -m "feat: add SQLite initialization and schema"
```

---

## Task 3: Pinia 스토어 — mediaStore

**Files:**
- Create: `frontend/src/stores/mediaStore.js`

- [ ] **Step 1: mediaStore.js 작성**

```javascript
// src/stores/mediaStore.js
import { defineStore } from 'pinia';
import { getDB } from './db';
import { v4 as uuidv4 } from 'uuid';

export const useMediaStore = defineStore('media', {
  state: () => ({
    groups: [],
    loading: false,
  }),

  actions: {
    async loadGroups() {
      const db = getDB();
      if (!db) return;
      this.loading = true;
      const result = await db.query(
        'SELECT * FROM media_groups ORDER BY registeredAt DESC'
      );
      this.groups = result.values || [];
      this.loading = false;
    },

    async addGroup({ sourceUrl, platform, mode, thumbnailPath, items, tagIds }) {
      const db = getDB();
      if (!db) return;

      const groupId = uuidv4();
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO media_groups (id, sourceUrl, platform, mode, thumbnailPath, totalCount, createdAt, registeredAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [groupId, sourceUrl, platform, mode, thumbnailPath || null, items.length, now, now]
      );

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await db.run(
          `INSERT INTO media_items (id, groupId, filePath, remoteUrl, type, itemIndex, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), groupId, item.filePath || null, item.remoteUrl || null, item.type, i, now]
        );
      }

      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await db.run(
            'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
            [groupId, tagId]
          );
          await db.run(
            'UPDATE tags SET count = count + 1 WHERE id = ?',
            [tagId]
          );
        }
      }

      await this.loadGroups();
      return groupId;
    },

    async deleteGroup(groupId) {
      const db = getDB();
      if (!db) return;
      // group_tags와 media_items는 CASCADE로 자동 삭제
      await db.run('DELETE FROM media_groups WHERE id = ?', [groupId]);
      await this.loadGroups();
    },

    async deleteItem(itemId, groupId) {
      const db = getDB();
      if (!db) return;
      await db.run('DELETE FROM media_items WHERE id = ?', [itemId]);
      // totalCount 갱신
      const result = await db.query(
        'SELECT COUNT(*) as cnt FROM media_items WHERE groupId = ?',
        [groupId]
      );
      const cnt = result.values?.[0]?.cnt ?? 0;
      if (cnt === 0) {
        await this.deleteGroup(groupId);
      } else {
        await db.run(
          'UPDATE media_groups SET totalCount = ? WHERE id = ?',
          [cnt, groupId]
        );
        await this.loadGroups();
      }
    },

    async getItemsByGroup(groupId) {
      const db = getDB();
      if (!db) return [];
      const result = await db.query(
        'SELECT * FROM media_items WHERE groupId = ? ORDER BY itemIndex ASC',
        [groupId]
      );
      return result.values || [];
    },
  },
});
```

- [ ] **Step 2: uuid 설치**

```bash
cd C:/work/myeon/workspace/hye_yoon1110/frontend
npm install uuid
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/stores/mediaStore.js
git commit -m "feat: add mediaStore with CRUD for groups and items"
```

---

## Task 4: Pinia 스토어 — tagStore

**Files:**
- Create: `frontend/src/stores/tagStore.js`

- [ ] **Step 1: tagStore.js 작성**

```javascript
// src/stores/tagStore.js
import { defineStore } from 'pinia';
import { getDB } from './db';
import { v4 as uuidv4 } from 'uuid';

export const useTagStore = defineStore('tag', {
  state: () => ({
    tags: [],
  }),

  getters: {
    sortedByCount: (state) =>
      [...state.tags].sort((a, b) => b.count - a.count),

    byChosung: (state) => {
      const CHOSUNG = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
      const CHOSUNG_UNICODE_START = 0xAC00;
      const CHOSUNG_STEP = 21 * 28;

      function getChosung(char) {
        const code = char.charCodeAt(0);
        if (code >= CHOSUNG_UNICODE_START && code <= 0xD7A3) {
          const idx = Math.floor((code - CHOSUNG_UNICODE_START) / CHOSUNG_STEP);
          return CHOSUNG[idx] || '#';
        }
        return '#';
      }

      const grouped = {};
      for (const tag of state.tags) {
        const cs = getChosung(tag.name[0]);
        if (!grouped[cs]) grouped[cs] = [];
        grouped[cs].push(tag);
      }
      return grouped;
    },
  },

  actions: {
    async loadTags() {
      const db = getDB();
      if (!db) return;
      const result = await db.query('SELECT * FROM tags ORDER BY name ASC');
      this.tags = result.values || [];
    },

    async findOrCreateTag(name) {
      const db = getDB();
      if (!db) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;

      const existing = await db.query(
        'SELECT * FROM tags WHERE name = ?',
        [trimmed]
      );
      if (existing.values?.length > 0) return existing.values[0];

      const id = uuidv4();
      const now = new Date().toISOString();
      await db.run(
        'INSERT INTO tags (id, name, count, createdAt) VALUES (?, ?, 0, ?)',
        [id, trimmed, now]
      );
      await this.loadTags();
      return { id, name: trimmed, count: 0, createdAt: now };
    },

    async getTagsByGroup(groupId) {
      const db = getDB();
      if (!db) return [];
      const result = await db.query(
        `SELECT t.* FROM tags t
         INNER JOIN group_tags gt ON t.id = gt.tagId
         WHERE gt.groupId = ?`,
        [groupId]
      );
      return result.values || [];
    },

    async removeTagFromGroup(groupId, tagId) {
      const db = getDB();
      if (!db) return;
      await db.run(
        'DELETE FROM group_tags WHERE groupId = ? AND tagId = ?',
        [groupId, tagId]
      );
      await db.run(
        'UPDATE tags SET count = MAX(0, count - 1) WHERE id = ?',
        [tagId]
      );
      await this.loadTags();
    },
  },
});
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/stores/tagStore.js
git commit -m "feat: add tagStore with chosung grouping and CRUD"
```

---

## Task 5: config.js + settingsStore + 하단 탭 레이아웃

**Files:**
- Create: `frontend/src/config.js`
- Create: `frontend/src/stores/settingsStore.js`
- Modify: `frontend/src/layouts/MainLayout.vue`
- Modify: `frontend/src/router/index.js`
- Modify: `frontend/src/pages/ManagePage.vue`
- Modify: `frontend/src/pages/UnmanagedPage.vue`
- Modify: `frontend/src/pages/DownloadPage.vue`
- Modify: `frontend/src/pages/SettingsPage.vue`

- [ ] **Step 1: config.js 작성 (백엔드 URL 하드코딩)**

백엔드 URL은 설정 UI에 노출하지 않고 코드에 고정한다. Railway 배포 후 여기만 수정하면 된다.

```javascript
// src/config.js
export const BACKEND_URL = 'https://your-app.railway.app';
```

> Plan 1 완료 후 Railway에서 발급된 URL로 이 값을 교체한다.

- [ ] **Step 2: settingsStore.js 작성**

```javascript
// src/stores/settingsStore.js
import { defineStore } from 'pinia';

// 백엔드 URL은 config.js에 하드코딩. 이 스토어는 UI 상태만 관리.
export const useSettingsStore = defineStore('settings', {
  state: () => ({}),
});
```

- [ ] **Step 3: router/index.js 수정**

```javascript
import { createRouter, createWebHashHistory } from 'vue-router';
import MainLayout from 'layouts/MainLayout.vue';

const routes = [
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', redirect: '/manage' },
      { path: '/manage', component: () => import('pages/ManagePage.vue') },
      { path: '/unmanaged', component: () => import('pages/UnmanagedPage.vue') },
      { path: '/download', component: () => import('pages/DownloadPage.vue') },
      { path: '/settings', component: () => import('pages/SettingsPage.vue') },
      { path: '/guide', component: () => import('pages/GuidePage.vue') },
    ],
  },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
```

- [ ] **Step 3: MainLayout.vue 작성**

```vue
<template>
  <q-layout view="lHh lpr lFf">
    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer>
      <q-tabs
        v-model="activeTab"
        class="bg-grey-10 text-grey-5"
        active-color="pink-5"
        indicator-color="pink-5"
        align="justify"
      >
        <q-tab name="manage" icon="photo_library" label="관리" to="/manage" exact />
        <q-tab name="unmanaged" icon="folder_open" label="미관리" to="/unmanaged" exact />
        <q-tab name="download" icon="download" label="다운로드" to="/download" exact />
        <q-tab name="settings" icon="settings" label="설정" to="/settings" exact />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const activeTab = computed(() => route.path.replace('/', '') || 'manage');
</script>
```

- [ ] **Step 4: 각 Page를 최소 껍데기로 작성**

`ManagePage.vue`:
```vue
<template>
  <q-page class="bg-grey-10">
    <div class="text-white q-pa-md">관리 목록 (구현 예정)</div>
  </q-page>
</template>
```

`UnmanagedPage.vue`:
```vue
<template>
  <q-page class="bg-grey-10">
    <div class="text-white q-pa-md">미관리 목록 (구현 예정)</div>
  </q-page>
</template>
```

`DownloadPage.vue`:
```vue
<template>
  <q-page class="bg-grey-10">
    <div class="text-white q-pa-md">다운로드 (구현 예정)</div>
  </q-page>
</template>
```

`SettingsPage.vue`:
```vue
<template>
  <q-page class="bg-grey-10">
    <div class="text-white q-pa-md">설정 (구현 예정)</div>
  </q-page>
</template>
```

- [ ] **Step 5: 브라우저에서 탭 동작 확인**

```bash
quasar dev
```
예상 결과: 하단에 탭 4개 표시, 탭 클릭 시 페이지 전환 동작

- [ ] **Step 6: App.vue에서 initDB 호출**

`src/App.vue`의 `<script setup>` 섹션:
```vue
<script setup>
import { onMounted } from 'vue';
import { initDB } from './stores/db';

onMounted(async () => {
  await initDB();
});
</script>
```

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/
git commit -m "feat: add tab navigation, page stubs, and settings store"
```

---

## Task 6: Capacitor Android 빌드 확인

**Files:**
- Modify: `frontend/capacitor.config.json`

- [ ] **Step 1: capacitor.config.json 설정**

```json
{
  "appId": "com.hyeyoon.mediamanager",
  "appName": "Media Manager",
  "webDir": "dist/spa",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "CapacitorSQLite": {
      "iosDatabaseLocation": "Library/CapacitorDatabase",
      "iosIsEncryption": false,
      "iosKeychainPrefix": "hyeyoon",
      "androidIsEncryption": false
    }
  }
}
```

- [ ] **Step 2: Android용 빌드**

```bash
cd C:/work/myeon/workspace/hye_yoon1110/frontend
quasar build
npx cap sync android
npx cap open android
```
예상 결과: Android Studio 열림

- [ ] **Step 3: Android Studio에서 에뮬레이터 또는 실기기로 실행**

Android Studio: `Run > Run 'app'`  
예상 결과: 앱 실행, 하단 탭 4개 표시

- [ ] **Step 4: 커밋**

```bash
git add frontend/capacitor.config.json
git commit -m "feat: configure Capacitor Android build"
```

---

## 완료 기준

- [ ] `quasar dev` 실행 시 하단 탭 4개가 보이고 탭 전환 동작
- [ ] 라우터가 `/manage`, `/unmanaged`, `/download`, `/settings` 경로 처리
- [ ] `src/config.js`의 `BACKEND_URL`이 Railway 배포 URL로 설정됨
- [ ] Android 에뮬레이터 또는 실기기에서 앱 실행 확인
- [ ] SQLite 스키마 4개 테이블 정상 생성 (네이티브 환경)
