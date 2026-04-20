# Backend (yt-dlp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Railway에 배포된 Node.js 서버에서 yt-dlp를 사용해 SNS URL의 미디어 정보를 추출하고 프록시 스트리밍을 제공한다.

**Architecture:** Express 서버가 `/api/fetch`로 URL을 받아 yt-dlp(Python subprocess)로 미디어 URL을 추출한 뒤 플랫폼 정보와 함께 반환한다. 미디어 파일 자체는 앱이 직접 다운로드하며, 서버는 CORS 문제 발생 시 `/api/proxy`로 스트리밍만 중계한다.

**Tech Stack:** Node.js 18+, Express 4, yt-dlp (Python), Railway 호스팅, dotenv

---

## File Structure

```
hye_yoon1110/
└── backend/
    ├── package.json          # 의존성: express, cors, dotenv, axios
    ├── .env.example          # 환경변수 예시
    ├── .gitignore
    ├── server.js             # Express 앱 진입점, 미들웨어 등록
    └── src/
        ├── routes/
        │   ├── fetch.js      # POST /api/fetch — yt-dlp 호출, 미디어 정보 반환
        │   └── proxy.js      # GET /api/proxy — 미디어 프록시 스트리밍
        └── lib/
            ├── ytdlp.js      # yt-dlp subprocess 실행 및 결과 파싱
            └── platform.js   # URL에서 플랫폼 자동 감지
```

---

## Task 1: 프로젝트 초기화

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/server.js`

- [ ] **Step 1: backend 폴더 생성 및 npm 초기화**

```bash
mkdir -p C:/work/myeon/workspace/hye_yoon1110/backend
cd C:/work/myeon/workspace/hye_yoon1110/backend
npm init -y
```

- [ ] **Step 2: 의존성 설치**

```bash
npm install express cors dotenv axios
```

- [ ] **Step 3: .gitignore 생성**

```
node_modules/
.env
dist/
```

- [ ] **Step 4: .env.example 생성**

```
PORT=3000
```

- [ ] **Step 5: server.js 작성**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const fetchRoute = require('./src/routes/fetch');
const proxyRoute = require('./src/routes/proxy');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/fetch', fetchRoute);
app.use('/api/proxy', proxyRoute);
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Backend running → http://localhost:${PORT}`);
});
```

- [ ] **Step 6: package.json scripts 추가**

`backend/package.json`의 scripts 섹션을 아래로 수정:
```json
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js"
}
```

- [ ] **Step 7: 서버 실행 확인**

```bash
node server.js
```
예상 출력: `Backend running → http://localhost:3000`

다른 터미널에서:
```bash
curl http://localhost:3000/api/health
```
예상 출력: `{"status":"ok"}`

- [ ] **Step 8: 커밋**

```bash
cd C:/work/myeon/workspace/hye_yoon1110
git add backend/
git commit -m "feat: initialize backend express server"
```

---

## Task 2: 플랫폼 감지 유틸리티

**Files:**
- Create: `backend/src/lib/platform.js`

- [ ] **Step 1: src/lib 디렉토리 생성**

```bash
mkdir -p C:/work/myeon/workspace/hye_yoon1110/backend/src/lib
```

- [ ] **Step 2: platform.js 작성**

```javascript
const PLATFORM_RULES = [
  { pattern: /instagram\.com/, name: 'instagram' },
  { pattern: /x\.com|twitter\.com/, name: 'x' },
  { pattern: /tiktok\.com/, name: 'tiktok' },
  { pattern: /youtube\.com|youtu\.be/, name: 'youtube' },
  { pattern: /facebook\.com|fb\.com/, name: 'facebook' },
];

function detectPlatform(url) {
  for (const rule of PLATFORM_RULES) {
    if (rule.pattern.test(url)) return rule.name;
  }
  return 'other';
}

module.exports = { detectPlatform };
```

- [ ] **Step 3: 수동 확인**

Node.js REPL에서:
```bash
node -e "
const { detectPlatform } = require('./src/lib/platform');
console.log(detectPlatform('https://www.instagram.com/p/ABC')); // instagram
console.log(detectPlatform('https://x.com/user/status/123'));   // x
console.log(detectPlatform('https://tiktok.com/@user/video/1')); // tiktok
console.log(detectPlatform('https://example.com'));              // other
"
```
예상 출력:
```
instagram
x
tiktok
other
```

- [ ] **Step 4: 커밋**

```bash
git add backend/src/lib/platform.js
git commit -m "feat: add platform auto-detection utility"
```

---

## Task 3: yt-dlp 설치 및 래퍼 구현

**Files:**
- Create: `backend/src/lib/ytdlp.js`

- [ ] **Step 1: yt-dlp 설치 확인**

Railway 배포 환경에서는 nixpacks가 Python + yt-dlp를 자동 설치한다.  
로컬 개발 환경에서는 수동 설치 필요:

```bash
# Windows (PowerShell)
winget install yt-dlp
# 또는
pip install yt-dlp
```

설치 확인:
```bash
yt-dlp --version
```
예상 출력: `2024.xx.xx` 형태의 버전 문자열

- [ ] **Step 2: ytdlp.js 작성**

```javascript
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * yt-dlp로 URL에서 미디어 정보를 추출한다.
 * @param {string} url - SNS 게시물 URL
 * @returns {Promise<Array<{url: string, type: string, index: number}>>}
 */
async function extractMedia(url) {
  const args = [
    '--dump-json',
    '--flat-playlist',
    '--no-playlist',
    url,
  ];

  let stdout;
  try {
    ({ stdout } = await execFileAsync('yt-dlp', args, { timeout: 30000 }));
  } catch (err) {
    throw new Error(`yt-dlp 실행 실패: ${err.message}`);
  }

  const items = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);

  if (items.length === 0) throw new Error('미디어를 찾을 수 없습니다.');

  const media = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 영상
    if (item.url && (item.ext === 'mp4' || item.vcodec)) {
      media.push({ url: item.url, type: 'video', index: i });
      continue;
    }

    // 이미지
    if (item.url) {
      media.push({ url: item.url, type: 'image', index: i });
    }
  }

  return media;
}

module.exports = { extractMedia };
```

- [ ] **Step 3: 로컬에서 yt-dlp 수동 테스트**

공개된 트위터/X 게시물 URL로 테스트:
```bash
yt-dlp --dump-json "https://x.com/NASA/status/1234567890" 2>/dev/null | head -c 500
```
예상 출력: JSON 형태의 미디어 정보 (url, ext 등 포함)

- [ ] **Step 4: 커밋**

```bash
git add backend/src/lib/ytdlp.js
git commit -m "feat: add yt-dlp wrapper for media extraction"
```

---

## Task 4: /api/fetch 라우트 구현

**Files:**
- Create: `backend/src/routes/fetch.js`

- [ ] **Step 1: src/routes 디렉토리 생성**

```bash
mkdir -p C:/work/myeon/workspace/hye_yoon1110/backend/src/routes
```

- [ ] **Step 2: fetch.js 작성**

```javascript
const express = require('express');
const { extractMedia } = require('../lib/ytdlp');
const { detectPlatform } = require('../lib/platform');

const router = express.Router();

router.post('/', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: '올바른 URL을 입력해주세요.',
    });
  }

  const platform = detectPlatform(url);

  try {
    const media = await extractMedia(url);

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

- [ ] **Step 3: 서버 실행 후 수동 테스트**

```bash
node server.js
```

다른 터미널에서 공개 게시물 URL로 테스트:
```bash
curl -X POST http://localhost:3000/api/fetch \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://x.com/NASA/status/1234567890\"}"
```

예상 응답:
```json
{
  "success": true,
  "platform": "x",
  "sourceUrl": "https://x.com/NASA/status/1234567890",
  "media": [
    { "url": "https://...", "type": "video", "index": 0 }
  ]
}
```

잘못된 URL 테스트:
```bash
curl -X POST http://localhost:3000/api/fetch \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"not-a-url\"}"
```
예상 응답: `{"success":false,"message":"올바른 URL을 입력해주세요."}`

- [ ] **Step 4: 커밋**

```bash
git add backend/src/routes/fetch.js
git commit -m "feat: implement POST /api/fetch with yt-dlp"
```

---

## Task 5: /api/proxy 라우트 구현

**Files:**
- Create: `backend/src/routes/proxy.js`

- [ ] **Step 1: axios 확인**

```bash
node -e "require('axios'); console.log('axios OK')"
```

- [ ] **Step 2: proxy.js 작성**

```javascript
const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/', async (req, res) => {
  const { url } = req.query;

  if (!url || !url.startsWith('http')) {
    return res.status(400).send('url 파라미터가 필요합니다.');
  }

  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.instagram.com/',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios.get(url, {
      responseType: 'stream',
      headers,
      timeout: 60000,
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
      res.status(206);
    }

    response.data.pipe(res);
  } catch (err) {
    console.error('[proxy error]', err.message);
    res.status(500).send('프록시 오류: ' + err.message);
  }
});

module.exports = router;
```

- [ ] **Step 3: 프록시 수동 테스트**

서버 실행 후:
```bash
curl "http://localhost:3000/api/proxy?url=https://picsum.photos/200" --output test.jpg
```
예상 결과: `test.jpg` 파일 생성됨 (약 10KB 내외)

- [ ] **Step 4: 커밋**

```bash
git add backend/src/routes/proxy.js
git commit -m "feat: implement GET /api/proxy for media streaming"
```

---

## Task 6: Railway 배포 설정

**Files:**
- Create: `backend/railway.json` (선택)
- Create: `backend/nixpacks.toml`

- [ ] **Step 1: nixpacks.toml 작성 (yt-dlp 자동 설치)**

```toml
[phases.setup]
nixPkgs = ["python311", "yt-dlp"]

[start]
cmd = "node server.js"
```

- [ ] **Step 2: railway.json 작성**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

- [ ] **Step 3: 기존 Railway 프로젝트에 backend 폴더를 루트로 배포 설정**

Railway 대시보드에서:
1. 기존 프로젝트 또는 신규 프로젝트 생성
2. "Deploy from GitHub" 선택
3. `hye_yoon1110` 레포지토리 연결
4. Root Directory를 `backend`로 설정
5. 배포 후 생성된 URL 확인 (예: `https://hye-yoon-backend.railway.app`)

- [ ] **Step 4: 배포 후 health check 확인**

```bash
curl https://YOUR-RAILWAY-URL.railway.app/api/health
```
예상 출력: `{"status":"ok"}`

- [ ] **Step 5: 배포 후 fetch 테스트**

```bash
curl -X POST https://YOUR-RAILWAY-URL.railway.app/api/fetch \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://x.com/NASA/status/1234567890\"}"
```
예상 응답: `{"success":true,"platform":"x",...}`

- [ ] **Step 6: 커밋**

```bash
git add backend/railway.json backend/nixpacks.toml
git commit -m "feat: add Railway deployment config with yt-dlp"
```

---

## 완료 기준

- [ ] `GET /api/health` → `{"status":"ok"}`
- [ ] `POST /api/fetch` + Instagram URL → `{success:true, platform:"instagram", media:[...]}`
- [ ] `POST /api/fetch` + X URL → `{success:true, platform:"x", media:[...]}`
- [ ] `POST /api/fetch` + TikTok URL → `{success:true, platform:"tiktok", media:[...]}`
- [ ] `GET /api/proxy?url=...` → 미디어 스트리밍 응답
- [ ] 잘못된 URL → `{success:false, message:"..."}`
- [ ] Railway 배포 후 위 모든 항목 통과
