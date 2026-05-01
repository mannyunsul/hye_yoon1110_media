# WebAuth Login (Instagram/X) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱 내 WebView로 Instagram/X 로그인 후 쿠키를 추출해 yt-dlp에 전달, 미디어 다운로드/북마크 가능하게 한다.

**Architecture:** Android 네이티브 WebView 플러그인(Java)으로 로그인 + 쿠키 추출 → Capacitor 브릿지로 Vue에 전달 → Preferences에 저장 → 백엔드 요청 시 쿠키 전송 → yt-dlp `--cookies` 옵션으로 전달.

**Tech Stack:** Capacitor 8, Android WebView (Java), @capacitor/preferences, Vue 3, Node.js/Express, yt-dlp

---

## File Map

| 파일 | 역할 |
|------|------|
| `frontend/src-capacitor/android/app/src/main/java/com/hyeyoon/mediamanager/WebAuthPlugin.java` | **신규** - WebView 로그인 + 쿠키 추출 Android 플러그인 |
| `frontend/src-capacitor/android/app/src/main/java/com/hyeyoon/mediamanager/MainActivity.java` | **수정** - WebAuthPlugin 등록 |
| `frontend/src/composables/useWebAuth.js` | **신규** - WebAuthPlugin 호출 + Preferences 저장/조회 |
| `frontend/src/pages/SettingsPage.vue` | **수정** - 계정 연결 UI 추가 |
| `frontend/src/composables/useDownload.js` | **수정** - 요청 시 저장된 쿠키 포함 |
| `backend/src/routes/fetch.js` | **수정** - 요청 body에서 cookies 수신 |
| `backend/src/lib/ytdlp.js` | **수정** - 쿠키를 임시파일로 저장 후 yt-dlp에 전달 |

---

## Task 1: Android WebAuthPlugin 생성

**Files:**
- Create: `frontend/src-capacitor/android/app/src/main/java/com/hyeyoon/mediamanager/WebAuthPlugin.java`

- [ ] **Step 1: WebAuthPlugin.java 파일 생성**

```java
package com.hyeyoon.mediamanager;

import android.app.Dialog;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WebAuth")
public class WebAuthPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        String platform = call.getString("platform");
        if (platform == null) {
            call.reject("platform is required");
            return;
        }

        String loginUrl;
        switch (platform) {
            case "instagram":
                loginUrl = "https://www.instagram.com/accounts/login/";
                break;
            case "x":
                loginUrl = "https://x.com/i/flow/login";
                break;
            default:
                call.reject("unsupported platform: " + platform);
                return;
        }

        final String finalPlatform = platform;

        getActivity().runOnUiThread(() -> {
            Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            WebView webView = new WebView(getActivity());
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
            );

            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    if (url == null) return;

                    boolean loginSuccess = false;
                    String cookieDomain;

                    if (finalPlatform.equals("instagram")) {
                        loginSuccess = url.contains("instagram.com") &&
                                      !url.contains("accounts/login") &&
                                      !url.contains("accounts/signup");
                        cookieDomain = "https://www.instagram.com";
                    } else {
                        loginSuccess = url.contains("x.com/home") ||
                                      url.contains("twitter.com/home");
                        cookieDomain = "https://x.com";
                    }

                    if (loginSuccess) {
                        CookieManager.getInstance().flush();
                        String cookies = CookieManager.getInstance().getCookie(cookieDomain);
                        dialog.dismiss();

                        JSObject result = new JSObject();
                        result.put("cookies", cookies != null ? cookies : "");
                        call.resolve(result);
                    }
                }
            });

            dialog.setContentView(webView);
            dialog.show();
            webView.loadUrl(loginUrl);
        });
    }
}
```

---

## Task 2: MainActivity에 플러그인 등록

**Files:**
- Modify: `frontend/src-capacitor/android/app/src/main/java/com/hyeyoon/mediamanager/MainActivity.java`

- [ ] **Step 1: MainActivity.java 수정**

```java
package com.hyeyoon.mediamanager;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WebAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

---

## Task 3: @capacitor/preferences 설치

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src-capacitor/package.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd frontend
npm install @capacitor/preferences
```

- [ ] **Step 2: Capacitor sync**

```bash
cd frontend
npx cap sync android
```

---

## Task 4: useWebAuth.js 컴포저블 생성

**Files:**
- Create: `frontend/src/composables/useWebAuth.js`

- [ ] **Step 1: useWebAuth.js 생성**

```js
import { registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'

const WebAuth = registerPlugin('WebAuth')

const PREF_KEY = {
  instagram: 'cookies_instagram',
  x: 'cookies_x',
}

export function useWebAuth() {
  async function login(platform) {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('로그인은 앱에서만 가능합니다.')
    }
    const result = await WebAuth.login({ platform })
    if (!result.cookies) throw new Error('쿠키를 가져오지 못했습니다.')
    await Preferences.set({ key: PREF_KEY[platform], value: result.cookies })
    return result.cookies
  }

  async function getCookies(platform) {
    const { value } = await Preferences.get({ key: PREF_KEY[platform] })
    return value || null
  }

  async function logout(platform) {
    await Preferences.remove({ key: PREF_KEY[platform] })
  }

  async function isLoggedIn(platform) {
    const cookies = await getCookies(platform)
    return !!cookies
  }

  return { login, getCookies, logout, isLoggedIn }
}
```

---

## Task 5: SettingsPage에 계정 연결 UI 추가

**Files:**
- Modify: `frontend/src/pages/SettingsPage.vue`

- [ ] **Step 1: SettingsPage.vue 수정**

`<script setup>` 상단에 추가:
```js
import { ref, onMounted } from 'vue'
import { useWebAuth } from '../composables/useWebAuth'

const { login, logout, isLoggedIn } = useWebAuth()

const igConnected = ref(false)
const xConnected = ref(false)
const igLoading = ref(false)
const xLoading = ref(false)

onMounted(async () => {
  igConnected.value = await isLoggedIn('instagram')
  xConnected.value = await isLoggedIn('x')
})

async function connectInstagram() {
  igLoading.value = true
  try {
    await login('instagram')
    igConnected.value = true
    $q.notify({ message: 'Instagram 연결 완료!' })
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    igLoading.value = false
  }
}

async function connectX() {
  xLoading.value = true
  try {
    await login('x')
    xConnected.value = true
    $q.notify({ message: 'X 연결 완료!' })
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  } finally {
    xLoading.value = false
  }
}

async function disconnectInstagram() {
  await logout('instagram')
  igConnected.value = false
}

async function disconnectX() {
  await logout('x')
  xConnected.value = false
}
```

`<template>` 기존 백업 카드 아래에 추가:
```html
<!-- 계정 연결 카드 -->
<q-card flat bordered class="bg-grey-9 q-mb-md">
  <q-card-section>
    <div class="text-subtitle2 text-grey-4 q-mb-sm">🔗 계정 연결</div>

    <!-- Instagram -->
    <div class="row items-center justify-between q-mb-sm">
      <div class="row items-center q-gutter-sm">
        <q-icon name="photo_camera" color="pink-4" />
        <span class="text-grey-3">Instagram</span>
        <q-badge v-if="igConnected" color="positive" label="연결됨" />
      </div>
      <q-btn
        v-if="!igConnected"
        unelevated dense
        label="로그인"
        color="pink-6"
        :loading="igLoading"
        @click="connectInstagram"
      />
      <q-btn
        v-else
        unelevated dense
        label="연결 해제"
        color="grey-7"
        @click="disconnectInstagram"
      />
    </div>

    <!-- X -->
    <div class="row items-center justify-between">
      <div class="row items-center q-gutter-sm">
        <q-icon name="close" color="grey-3" />
        <span class="text-grey-3">X (Twitter)</span>
        <q-badge v-if="xConnected" color="positive" label="연결됨" />
      </div>
      <q-btn
        v-if="!xConnected"
        unelevated dense
        label="로그인"
        color="grey-7"
        :loading="xLoading"
        @click="connectX"
      />
      <q-btn
        v-else
        unelevated dense
        label="연결 해제"
        color="grey-7"
        @click="disconnectX"
      />
    </div>
  </q-card-section>
</q-card>
```

---

## Task 6: useDownload.js - 쿠키 포함하여 요청

**Files:**
- Modify: `frontend/src/composables/useDownload.js`

- [ ] **Step 1: useDownload.js 수정**

```js
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import axios from 'axios'
import { BACKEND_URL } from '../config'
import { useWebAuth } from './useWebAuth'

export function useDownload() {
  const { getCookies } = useWebAuth()

  async function fetchMediaInfo(url) {
    const platform = detectPlatform(url)
    const cookies = await getCookies(platform)

    const { data } = await axios.post(
      `${BACKEND_URL}/api/fetch`,
      { url, cookies },
      { timeout: 30000 }
    )
    if (!data.success) throw new Error(data.message || '미디어 추출 실패')
    return data
  }

  function detectPlatform(url) {
    if (url.includes('instagram.com')) return 'instagram'
    if (url.includes('x.com') || url.includes('twitter.com')) return 'x'
    return 'other'
  }

  async function downloadFile(remoteUrl, filename) {
    if (!Capacitor.isNativePlatform()) {
      console.warn('파일 저장은 네이티브 환경에서만 동작합니다.')
      return null
    }

    const response = await axios.get(remoteUrl, { responseType: 'blob' })
    const blob = response.data
    const base64 = await blobToBase64(blob)

    const result = await Filesystem.writeFile({
      path: `MediaManager/${filename}`,
      data: base64,
      directory: Directory.External,
      recursive: true,
    })

    return result.uri
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  function generateFilename(type, index) {
    const ts = Date.now()
    const ext = type === 'video' ? 'mp4' : 'jpg'
    return `media_${ts}_${index}.${ext}`
  }

  return { fetchMediaInfo, downloadFile, generateFilename }
}
```

---

## Task 7: 백엔드 ytdlp.js - 쿠키 파일 지원

**Files:**
- Modify: `backend/src/lib/ytdlp.js`

- [ ] **Step 1: ytdlp.js 수정**

```js
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const execFileAsync = promisify(execFile);

function buildCookieFile(cookieString, domain) {
  const lines = ['# Netscape HTTP Cookie File'];
  cookieString.split(';').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return;
    const name = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    if (!name) return;
    lines.push(`${domain}\tTRUE\t/\tFALSE\t2147483647\t${name}\t${value}`);
  });
  return lines.join('\n');
}

async function extractMedia(url, cookies = null) {
  const args = [
    '--dump-json',
    '--flat-playlist',
    '--no-playlist',
  ];

  let cookieFilePath = null;

  if (cookies) {
    const domain = url.includes('instagram.com') ? '.instagram.com' : '.x.com';
    const content = buildCookieFile(cookies, domain);
    cookieFilePath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
    fs.writeFileSync(cookieFilePath, content, 'utf8');
    args.push('--cookies', cookieFilePath);
  }

  args.push(url);

  let stdout;
  try {
    ({ stdout } = await execFileAsync('yt-dlp', args, { timeout: 30000 }));
  } catch (err) {
    throw new Error(`yt-dlp 실행 실패: ${err.message}`);
  } finally {
    if (cookieFilePath && fs.existsSync(cookieFilePath)) {
      fs.unlinkSync(cookieFilePath);
    }
  }

  const items = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

  if (items.length === 0) throw new Error('미디어를 찾을 수 없습니다.');

  const media = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.url && (item.ext === 'mp4' || item.vcodec)) {
      media.push({ url: item.url, type: 'video', index: i });
      continue;
    }
    if (item.url) {
      media.push({ url: item.url, type: 'image', index: i });
    }
  }

  return media;
}

module.exports = { extractMedia };
```

---

## Task 8: 백엔드 fetch.js - cookies 수신

**Files:**
- Modify: `backend/src/routes/fetch.js`

- [ ] **Step 1: fetch.js 수정**

```js
const express = require('express');
const { extractMedia } = require('../lib/ytdlp');
const { detectPlatform } = require('../lib/platform');

const router = express.Router();

router.post('/', async (req, res) => {
  const { url, cookies } = req.body;

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: '올바른 URL을 입력해주세요.',
    });
  }

  const platform = detectPlatform(url);

  try {
    const media = await extractMedia(url, cookies || null);

    return res.json({
      success: true,
      platform,
      sourceUrl: url,
      media,
    });
  } catch (err) {
    console.error('[fetch error]', err.message);

    if (err.message.includes('yt-dlp 실행 실패')) {
      return res.status(500).json({
        success: false,
        message: '미디어 추출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
    }

    if (err.message.includes('찾을 수 없습니다')) {
      return res.status(404).json({
        success: false,
        message: '미디어를 찾을 수 없습니다. URL을 확인해주세요.',
      });
    }

    return res.status(500).json({
      success: false,
      message: `오류: ${err.message}`,
    });
  }
});

module.exports = router;
```

---

## Task 9: 빌드 및 배포

- [ ] **Step 1: 프론트엔드 빌드**

```bash
cd frontend
npm install @capacitor/preferences
quasar build -m capacitor -T android
```

- [ ] **Step 2: 백엔드 변경사항 커밋 & 푸시 (Railway 재배포)**

```bash
git add backend/src/lib/ytdlp.js backend/src/routes/fetch.js
git add frontend/src/composables/useWebAuth.js
git add frontend/src/composables/useDownload.js
git add frontend/src/pages/SettingsPage.vue
git add frontend/src-capacitor/android/app/src/main/java/com/hyeyoon/mediamanager/WebAuthPlugin.java
git add frontend/src-capacitor/android/app/src/main/java/com/hyeyoon/mediamanager/MainActivity.java
git commit -m "feat: add WebView login for Instagram/X cookie-based auth"
git push origin main
```

- [ ] **Step 3: Android Studio에서 APK 빌드 및 설치**

`frontend/src-capacitor/android` 폴더를 Android Studio에서 열고 Run ▶ 실행.

---

## 테스트 시나리오

1. 설정 탭 → Instagram 로그인 버튼 클릭 → WebView 열림
2. Instagram 로그인 완료 → 자동으로 WebView 닫힘 → "연결됨" 표시
3. 다운로드 탭 → Instagram URL 입력 → 미디어 가져오기 → 성공
4. 앱 재시작 후에도 로그인 상태 유지 확인
