# OneDrive + Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 탭4(설정 UI)를 완성하고, Microsoft Graph API로 OneDrive 자동 동기화 및 수동 백업/복원 기능을 구현한다.

**Architecture:** Microsoft Graph API는 @azure/msal-browser로 인증하고, OneDrive `/MediaManager/metadata.json`에 SQLite 메타데이터를 JSON으로 동기화한다. OneDrive 연결은 선택 사항이며 미연결 시에도 앱의 모든 기능이 정상 동작한다. 수동 백업은 JSON 파일을 기기 저장소에 내보내고 공유할 수 있다.

**Tech Stack:** @azure/msal-browser, Microsoft Graph API, @capacitor/share, @capacitor/filesystem

**전제 조건:** Plan 3 (핵심 기능) 완료, Microsoft Azure 앱 등록 (무료)

---

## Azure 앱 등록 (1회 설정)

Plan 실행 전 아래를 완료해야 한다:

1. [Azure Portal](https://portal.azure.com) → Azure Active Directory → 앱 등록 → 새 등록
2. 이름: `MediaManager`, 계정 유형: `모든 조직 디렉터리 + 개인 Microsoft 계정`
3. 리디렉션 URI: `http://localhost` (SPA)
4. API 권한 추가: `Microsoft Graph > Files.ReadWrite`
5. **클라이언트 ID** 복사 (`.env`에 저장)

---

## File Structure

```
frontend/src/
├── pages/
│   └── SettingsPage.vue          # 탭4: 설정 전체 UI
├── stores/
│   └── oneDriveStore.js          # OneDrive 인증 + 동기화 로직
└── composables/
    └── useBackup.js              # 수동 백업/복원 로직
```

---

## Task 1: MSAL + OneDrive 스토어

**Files:**
- Create: `frontend/src/stores/oneDriveStore.js`
- Modify: `frontend/.env.example`

- [ ] **Step 1: MSAL 설치**

```bash
cd C:/work/myeon/workspace/hye_yoon1110/frontend
npm install @azure/msal-browser
```

- [ ] **Step 2: .env.example 업데이트**

```
PORT=3000
VITE_MSAL_CLIENT_ID=your-azure-client-id-here
```

`.env` 파일(gitignore에 포함됨) 생성:
```
VITE_MSAL_CLIENT_ID=실제-클라이언트-ID
```

- [ ] **Step 3: oneDriveStore.js 작성**

```javascript
// src/stores/oneDriveStore.js
import { defineStore } from 'pinia';
import { PublicClientApplication } from '@azure/msal-browser';

const METADATA_PATH = '/MediaManager/metadata.json';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'localStorage' },
};

const scopes = ['Files.ReadWrite', 'User.Read'];

let msalInstance = null;

function getMsal() {
  if (!msalInstance) msalInstance = new PublicClientApplication(msalConfig);
  return msalInstance;
}

export const useOneDriveStore = defineStore('onedrive', {
  state: () => ({
    connected: false,
    account: null,
    syncing: false,
    lastSyncedAt: localStorage.getItem('onedrive_last_sync') || null,
  }),

  actions: {
    async init() {
      const msal = getMsal();
      await msal.initialize();
      const accounts = msal.getAllAccounts();
      if (accounts.length > 0) {
        this.account = accounts[0];
        this.connected = true;
      }
    },

    async login() {
      const msal = getMsal();
      try {
        const result = await msal.loginPopup({ scopes });
        this.account = result.account;
        this.connected = true;
      } catch (err) {
        if (err.errorCode !== 'user_cancelled') throw err;
      }
    },

    async logout() {
      const msal = getMsal();
      await msal.logoutPopup();
      this.account = null;
      this.connected = false;
    },

    async getAccessToken() {
      const msal = getMsal();
      const result = await msal.acquireTokenSilent({
        scopes,
        account: this.account,
      });
      return result.accessToken;
    },

    async syncToOneDrive(payload) {
      // payload: { media_groups, media_items, tags }
      if (!this.connected) return;
      this.syncing = true;
      try {
        const token = await this.getAccessToken();
        const body = JSON.stringify({
          version: 2,
          exportedAt: new Date().toISOString(),
          ...payload,
        });

        await fetch(
          `${GRAPH_BASE}/me/drive/root:${METADATA_PATH}:/content`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body,
          }
        );

        this.lastSyncedAt = new Date().toISOString();
        localStorage.setItem('onedrive_last_sync', this.lastSyncedAt);
      } finally {
        this.syncing = false;
      }
    },

    async restoreFromOneDrive() {
      if (!this.connected) throw new Error('OneDrive에 연결되어 있지 않습니다.');
      const token = await this.getAccessToken();

      const res = await fetch(
        `${GRAPH_BASE}/me/drive/root:${METADATA_PATH}:/content`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 404) throw new Error('OneDrive에 백업 파일이 없습니다.');
      if (!res.ok) throw new Error('OneDrive 복원 실패');

      return await res.json();
      // 반환값: { version, exportedAt, media_groups, media_items, tags }
    },
  },
});
```

- [ ] **Step 4: App.vue에서 oneDriveStore 초기화**

`src/App.vue`의 `onMounted` 추가:
```javascript
import { useOneDriveStore } from './stores/oneDriveStore';

onMounted(async () => {
  await initDB();
  const oneDriveStore = useOneDriveStore();
  await oneDriveStore.init();
});
```

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/stores/oneDriveStore.js frontend/.env.example
git commit -m "feat: add OneDrive MSAL authentication store"
```

---

## Task 2: 수동 백업/복원 composable

**Files:**
- Create: `frontend/src/composables/useBackup.js`

- [ ] **Step 1: @capacitor/share 설치**

```bash
npm install @capacitor/share
npx cap sync
```

- [ ] **Step 2: useBackup.js 작성**

```javascript
// src/composables/useBackup.js
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { getDB } from '../stores/db';

export function useBackup() {
  async function exportBackup() {
    const db = getDB();
    if (!db) throw new Error('DB가 초기화되지 않았습니다.');

    const groups = (await db.query('SELECT * FROM media_groups')).values || [];
    const items = (await db.query('SELECT * FROM media_items')).values || [];
    const tags = (await db.query('SELECT * FROM tags')).values || [];
    const groupTags = (await db.query('SELECT * FROM group_tags')).values || [];

    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      media_groups: groups,
      media_items: items,
      tags,
      group_tags: groupTags,
    };

    const json = JSON.stringify(payload, null, 2);
    const filename = `hyeyoon_backup_${Date.now()}.json`;

    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({
        path: filename,
        data: btoa(unescape(encodeURIComponent(json))),
        directory: Directory.Cache,
      });
      await Share.share({
        title: '미디어 매니저 백업',
        files: [result.uri],
      });
    } else {
      // 웹 환경: 파일 다운로드
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function importBackup(jsonString) {
    const db = getDB();
    if (!db) throw new Error('DB가 초기화되지 않았습니다.');

    let payload;
    try { payload = JSON.parse(jsonString); }
    catch { throw new Error('올바른 백업 파일이 아닙니다.'); }

    if (!payload.version || !payload.media_groups) {
      throw new Error('지원하지 않는 백업 형식입니다.');
    }

    // 기존 데이터 초기화 (CASCADE로 하위 테이블도 삭제)
    await db.run('DELETE FROM media_groups');
    await db.run('DELETE FROM tags');

    for (const g of payload.media_groups || []) {
      await db.run(
        `INSERT OR REPLACE INTO media_groups
         (id, sourceUrl, platform, mode, thumbnailPath, totalCount, createdAt, registeredAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [g.id, g.sourceUrl, g.platform, g.mode, g.thumbnailPath, g.totalCount, g.createdAt, g.registeredAt]
      );
    }

    for (const item of payload.media_items || []) {
      await db.run(
        `INSERT OR REPLACE INTO media_items
         (id, groupId, filePath, remoteUrl, type, itemIndex, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.groupId, item.filePath, item.remoteUrl, item.type, item.itemIndex, item.createdAt]
      );
    }

    for (const tag of payload.tags || []) {
      await db.run(
        'INSERT OR REPLACE INTO tags (id, name, count, createdAt) VALUES (?, ?, ?, ?)',
        [tag.id, tag.name, tag.count, tag.createdAt]
      );
    }

    for (const gt of payload.group_tags || []) {
      await db.run(
        'INSERT OR IGNORE INTO group_tags (groupId, tagId) VALUES (?, ?)',
        [gt.groupId, gt.tagId]
      );
    }
  }

  return { exportBackup, importBackup };
}
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/composables/useBackup.js
git commit -m "feat: add useBackup composable for export and import"
```

---

## Task 3: 자동 동기화 훅

**Files:**
- Modify: `frontend/src/stores/mediaStore.js`
- Modify: `frontend/src/stores/tagStore.js`

- [ ] **Step 1: mediaStore.js에 동기화 트리거 추가**

`mediaStore.js`의 `addGroup`, `deleteGroup`, `deleteItem` 액션 마지막에 아래 호출 추가:

```javascript
// 각 mutating 액션 마지막에 추가
import { useOneDriveStore } from './oneDriveStore';

async function triggerSync() {
  const oneDriveStore = useOneDriveStore();
  if (!oneDriveStore.connected) return;
  const db = getDB();
  const groups = (await db.query('SELECT * FROM media_groups')).values || [];
  const items = (await db.query('SELECT * FROM media_items')).values || [];
  const tags = (await db.query('SELECT * FROM tags')).values || [];
  const groupTags = (await db.query('SELECT * FROM group_tags')).values || [];
  await oneDriveStore.syncToOneDrive({ media_groups: groups, media_items: items, tags, group_tags: groupTags });
}
```

`addGroup` 액션 마지막:
```javascript
await this.loadGroups();
await triggerSync();    // 추가
return groupId;
```

`deleteGroup` 액션 마지막:
```javascript
await this.loadGroups();
await triggerSync();    // 추가
```

`deleteItem` 액션 마지막 (그룹 남아있을 때):
```javascript
await this.loadGroups();
await triggerSync();    // 추가
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/stores/mediaStore.js
git commit -m "feat: add OneDrive auto-sync trigger on media mutations"
```

---

## Task 4: 탭4 — 설정 페이지

**Files:**
- Modify: `frontend/src/pages/SettingsPage.vue`

- [ ] **Step 1: SettingsPage.vue 작성**

```vue
<template>
  <q-page class="bg-grey-10 q-pa-md">
    <div class="text-h6 text-grey-3 q-mb-md">⚙️ 설정</div>

    <!-- OneDrive 연동 카드 -->
    <q-card flat bordered class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-4 q-mb-sm">☁️ OneDrive 연동</div>

        <!-- 연결됨 -->
        <div v-if="oneDriveStore.connected">
          <div class="row items-center q-gutter-xs q-mb-sm">
            <q-icon name="check_circle" color="positive" />
            <span class="text-caption text-positive">연결됨</span>
            <span class="text-caption text-grey-6">· {{ oneDriveStore.account?.username }}</span>
          </div>

          <div class="row items-center justify-between q-mb-sm">
            <span class="text-caption text-grey-4">자동 동기화</span>
            <q-toggle v-model="autoSync" color="pink-5" dense />
          </div>

          <div v-if="oneDriveStore.lastSyncedAt" class="text-caption text-grey-6 q-mb-sm">
            마지막 동기화: {{ formatDate(oneDriveStore.lastSyncedAt) }}
          </div>

          <q-btn
            outline full-width dense
            label="OneDrive 복원"
            color="blue-4"
            :loading="restoring"
            class="q-mb-sm"
            @click="onRestore"
          />

          <q-btn
            flat full-width dense
            label="연결 해제"
            color="red-4"
            @click="onLogout"
          />
        </div>

        <!-- 미연결 -->
        <div v-else>
          <div class="text-caption text-grey-6 q-mb-sm">
            연결하면 메타데이터(태그, URL)가 자동으로 동기화됩니다.
          </div>
          <q-btn
            unelevated full-width
            label="Microsoft 계정으로 연결"
            color="blue-7"
            icon="cloud"
            :loading="connecting"
            @click="onLogin"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- 수동 백업 카드 -->
    <q-card flat bordered class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-4 q-mb-sm">💾 수동 백업</div>

        <q-btn
          unelevated full-width
          label="백업 내보내기"
          icon="upload"
          color="grey-7"
          class="q-mb-sm"
          :loading="exporting"
          @click="onExport"
        />

        <q-btn
          unelevated full-width
          label="백업 가져오기"
          icon="download"
          color="grey-7"
          @click="triggerImport"
        />
        <input ref="fileInput" type="file" accept=".json" hidden @change="onImport" />
      </q-card-section>
    </q-card>

    <!-- 백엔드 URL 카드 -->
    <q-card flat bordered class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-4 q-mb-sm">🌐 백엔드 서버 URL</div>
        <q-input
          v-model="backendUrlInput"
          dark outlined dense
          placeholder="https://your-app.railway.app"
          color="pink-5"
          class="q-mb-sm"
        >
          <template #prepend><q-icon name="dns" color="pink-4" /></template>
        </q-input>
        <q-btn
          unelevated full-width dense
          label="저장"
          color="pink-6"
          @click="saveBackendUrl"
        />
      </q-card-section>
    </q-card>

  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';
import { useOneDriveStore } from '../stores/oneDriveStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useBackup } from '../composables/useBackup';
import { useMediaStore } from '../stores/mediaStore';
import { useTagStore } from '../stores/tagStore';
import { getDB } from '../stores/db';

const $q = useQuasar();
const oneDriveStore = useOneDriveStore();
const settingsStore = useSettingsStore();
const mediaStore = useMediaStore();
const tagStore = useTagStore();
const { exportBackup, importBackup } = useBackup();

const connecting = ref(false);
const restoring = ref(false);
const exporting = ref(false);
const autoSync = ref(true);
const backendUrlInput = ref(settingsStore.backendUrl);
const fileInput = ref(null);

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR');
}

async function onLogin() {
  connecting.value = true;
  try {
    await oneDriveStore.login();
    $q.notify({ type: 'positive', message: 'OneDrive에 연결됐습니다!' });
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message });
  } finally {
    connecting.value = false;
  }
}

async function onLogout() {
  $q.dialog({
    title: '연결 해제',
    message: 'OneDrive 연결을 해제할까요? 로컬 데이터는 유지됩니다.',
    cancel: { label: '취소', flat: true },
    ok: { label: '해제', color: 'negative' },
    dark: true,
  }).onOk(async () => {
    await oneDriveStore.logout();
    $q.notify({ type: 'info', message: 'OneDrive 연결이 해제됐습니다.' });
  });
}

async function onRestore() {
  $q.dialog({
    title: 'OneDrive에서 복원',
    message: '현재 로컬 데이터가 OneDrive 백업으로 대체됩니다. 계속할까요?',
    cancel: { label: '취소', flat: true },
    ok: { label: '복원', color: 'blue-6' },
    dark: true,
  }).onOk(async () => {
    restoring.value = true;
    try {
      const payload = await oneDriveStore.restoreFromOneDrive();
      await importBackup(JSON.stringify(payload));
      await mediaStore.loadGroups();
      await tagStore.loadTags();
      $q.notify({ type: 'positive', message: 'OneDrive에서 복원 완료!' });
    } catch (err) {
      $q.notify({ type: 'negative', message: err.message });
    } finally {
      restoring.value = false;
    }
  });
}

async function onExport() {
  exporting.value = true;
  try {
    await exportBackup();
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message });
  } finally {
    exporting.value = false;
  }
}

function triggerImport() {
  fileInput.value?.click();
}

async function onImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  $q.dialog({
    title: '백업 가져오기',
    message: '현재 로컬 데이터가 삭제되고 백업 파일로 대체됩니다. 계속할까요?',
    cancel: { label: '취소', flat: true },
    ok: { label: '가져오기', color: 'orange-6' },
    dark: true,
  }).onOk(async () => {
    try {
      await importBackup(text);
      await mediaStore.loadGroups();
      await tagStore.loadTags();
      $q.notify({ type: 'positive', message: '백업 복원 완료!' });
    } catch (err) {
      $q.notify({ type: 'negative', message: err.message });
    }
    event.target.value = '';
  });
}

function saveBackendUrl() {
  settingsStore.saveBackendUrl(backendUrlInput.value);
  $q.notify({ type: 'positive', message: '백엔드 URL이 저장됐습니다.' });
}
</script>
```

- [ ] **Step 2: 설정 탭에서 동작 확인**

```bash
quasar dev
```
예상 결과:
- "Microsoft 계정으로 연결" 버튼 표시
- 백엔드 URL 입력 및 저장 동작
- 백업 내보내기 버튼 클릭 시 JSON 파일 다운로드 (웹 환경)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/pages/SettingsPage.vue
git commit -m "feat: implement SettingsPage with OneDrive and backup UI"
```

---

## Task 5: Android 최종 빌드 및 권한 설정

**Files:**
- Modify: `frontend/src-capacitor/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: AndroidManifest.xml에 권한 추가**

`src-capacitor/android/app/src/main/AndroidManifest.xml`의 `<manifest>` 태그 안에 추가:
```xml
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="29" />
<uses-permission android:name="android.permission.INTERNET" />
```

- [ ] **Step 2: 최종 Android 빌드**

```bash
cd C:/work/myeon/workspace/hye_yoon1110/frontend
quasar build
npx cap sync android
npx cap open android
```

Android Studio: `Build > Generate Signed Bundle / APK > APK`  
예상 결과: `app-release.apk` 파일 생성

- [ ] **Step 3: 실기기 테스트 체크리스트**

- [ ] OneDrive 로그인 동작 (팝업 열림)
- [ ] URL 입력 → 미디어 가져오기 → 갤러리 저장 확인
- [ ] 북마크 모드 → 파일 저장 없이 등록 확인
- [ ] 미관리 탭 → 갤러리 스캔 결과 표시
- [ ] 태그 등록 → 관리 탭으로 이동 확인
- [ ] 백업 내보내기 → 공유 다이얼로그 열림
- [ ] OneDrive 자동 동기화 → `/MediaManager/metadata.json` 생성 확인

- [ ] **Step 4: 최종 커밋**

```bash
git add frontend/src-capacitor/
git commit -m "feat: configure Android permissions for final build"
```

---

## 완료 기준

- [ ] 설정 탭에서 Microsoft 계정 로그인/로그아웃 동작
- [ ] 미디어 추가/삭제 시 OneDrive `/MediaManager/metadata.json` 자동 업데이트
- [ ] OneDrive 복원: 백업 파일 기반으로 로컬 DB 복원
- [ ] 수동 내보내기: JSON 파일 생성 + 공유 다이얼로그 열림
- [ ] 수동 가져오기: JSON 파일 선택 → DB 복원
- [ ] 백엔드 URL 저장 → 다운로드 탭에서 즉시 반영
- [ ] OneDrive 미연결 시 모든 핵심 기능 정상 동작
- [ ] Android APK 빌드 성공 + 실기기 전체 기능 동작
