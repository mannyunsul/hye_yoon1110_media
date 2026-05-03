# 미디어 매니저 앱 설계 문서

**최초 작성**: 2026-04-20
**최종 업데이트**: 2026-05-03
**상태**: 구현 완료 (현재 코드 기준 갱신)

---

## 1. 프로젝트 개요

SNS에서 이미지/영상을 다운로드하거나 URL만 북마크로 저장하고, 기기 갤러리의 미디어까지 통합 관리하는 모바일 앱.
태그, 출처 URL, 플랫폼 정보를 메타데이터로 관리하며 JSON 파일로 수동 백업한다.

---

## 2. 기술 스택

| 영역 | 기술 |
|---|---|
| 모바일 앱 | Quasar Framework (Vue 3) + Capacitor |
| 백엔드 | Node.js + yt-dlp (Railway 호스팅) |
| 로컬 DB | SQLite (@capacitor-community/sqlite) |
| 백업 | JSON 수동 내보내기/가져오기 |
| SNS 인증 | Capacitor WebAuth 네이티브 플러그인 (Instagram / X) |

---

## 3. 전체 아키텍처

```
┌─────────────────────────────────────┐
│         모바일 앱 (Quasar)           │
│                                     │
│  ┌──────────┐  ┌──────────────────┐ │
│  │ 관리 목록 │  │  미관리 목록      │ │
│  │ (태그/   │  │  (갤러리 미등록)  │ │
│  │  플랫폼) │  │                  │ │
│  └──────────┘  └──────────────────┘ │
│                                     │
│  ┌──────────────────────────────┐   │
│  │   다운로드 / 공유받기         │   │
│  └──────────────────────────────┘   │
└────────────┬────────────────────────┘
             │ API 호출
             ▼
┌─────────────────────────────────────┐
│  백엔드 (Railway)                    │
│  Node.js + yt-dlp                   │
│  - 미디어 URL 추출 (플랫폼별 전략)   │
│  - Instagram 4단계 fallback          │
│  - 미디어 프록시 스트리밍            │
└─────────────────────────────────────┘

┌──────────────────────────┐
│  기기 저장소              │
│  - 갤러리 (이미지/영상)   │
│  - SQLite (메타데이터)    │
└──────────────────────────┘
```

---

## 4. 백엔드 설계

### 역할
- yt-dlp로 SNS URL에서 미디어 직접 URL 추출
- Instagram 전용 이미지 추출 (4단계 fallback)
- 미디어 프록시 스트리밍 (다운로드 시 IP 불일치 우회)
- 플랫폼 자동 감지

### API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/fetch` | POST | URL → 미디어 그룹 정보 + 전체 미디어 URL 반환 |
| `/api/proxy` | GET | 미디어 프록시 스트리밍 |
| `/api/health` | GET | 서버 상태 확인 |

**`/api/fetch` 요청 형식:**
```json
{ "url": "https://instagram.com/p/xxx", "cookies": "sessionid=abc; csrftoken=..." }
```

**`/api/fetch` 응답 형식:**
```json
{
  "success": true,
  "platform": "instagram",
  "sourceUrl": "https://instagram.com/p/xxx",
  "media": [
    { "url": "...", "type": "image", "index": 0 },
    { "url": "...", "type": "video", "index": 1 }
  ]
}
```

### Instagram 이미지 추출 전략 (4단계 Fallback)

yt-dlp가 Instagram 이미지를 추출하지 못하는 경우가 많아 전용 fallback 로직 구현:

| 순서 | 방법 | 특징 |
|---|---|---|
| 1순위 | **Instagram Private API** (`/api/v1/media/shortcode/{code}/info/`) | 쿠키 필요, 캐러셀 전체 지원 |
| 2순위 | **임베드 페이지 파싱** (`/p/{code}/embed/captioned/`) | 인증 불필요, `display_url` 추출 |
| 3순위 | **직접 페이지 파싱** | `display_url` JSON 패턴 매칭 |
| 4순위 | **`og:image` fallback** | 단일 이미지만 가능 |

yt-dlp 실패 시 위 4단계를 순서대로 시도. 성공한 첫 번째 결과를 반환.

### yt-dlp 미디어 타입 판별

```js
const isVideo = item.ext === 'mp4' || (item.vcodec && item.vcodec !== 'none');
```
`vcodec: 'none'`은 이미지를 의미 → image로 분류.

### 지원 플랫폼
yt-dlp 기반으로 1000개 이상 사이트 자동 지원.
주요 플랫폼: Instagram (영상), X(Twitter), TikTok, YouTube 등.
Instagram 이미지 전용 추출 로직 별도 구현.

---

## 5. 앱 화면 구조

하단 탭 4개 구성. **페이지 이동 없이 바텀 시트**로 상세 정보 표시.

### 탭1 — 관리 목록 (`/manage`)
- 상단 검색창 (URL / 태그명 검색)
- 가로 스크롤 태그 필터바 (사용 빈도순 정렬) + 全 버튼
- 플랫폼 필터 칩 (전체 / 📸 IG / ✖ X / 🎵 TT / ▶ YT)
- 갤러리 그리드 뷰 — **1 URL = 1 묶음 항목**으로 표시
  - 대표 썸네일 (첫 번째 미디어) + 개수 뱃지
- **탭**: 바텀 시트 열림
- **롱프레스**: 빠른 메뉴 팝업 (출처 열기 / 태그 편집 / 전체 삭제)
- 全 버튼 → 태그 전체 목록 (초성별 섹션 + 오른쪽 초성 바로가기 + 개수 + **삭제 버튼**)

### 바텀 시트 (관리 목록 항목 탭 시)
- 미디어 좌우 스와이프 (carousel 전체 탐색)
- 현재 인덱스 표시 (예: `← 스와이프로 N장 모두 확인 →`)
- 플랫폼 뱃지 + 미디어 개수
- **현재 미디어만 삭제** 버튼
- 마지막 항목 삭제 시 → 그룹 전체 자동 삭제

### 탭2 — 미관리 목록 (`/unmanaged`)
- Capacitor MediaStore로 기기 갤러리 전체 파일 스캔
- SQLite `media_items`에 없는 파일 → 미관리 목록 표시
- 탭 진입 시 스캔 자동 실행
- 탭하면 선택 표시, 상단 "태그 등록 (N)" 버튼으로 태그 입력 후 저장

### 탭3 — 다운로드 (`/download`)
- **두 가지 모드** 선택: 다운로드 / 북마크
- URL 직접 입력 또는 다른 앱에서 공유받기 (Android SEND 인텐트 처리)
- 미리보기 (carousel은 좌우 스와이프)
- 태그 입력 후 저장

### 탭4 — 설정 (`/settings`)
- **계정 연결** — Instagram / X 로그인 (앱 내 WebView로 로그인 후 쿠키 저장)
  - 로그인 상태: "연결됨" 뱃지 + "연결 해제" 버튼
  - 비로그인 상태: "로그인" 버튼
  - 저장된 쿠키는 미디어 fetch 요청 시 백엔드로 전달
- **백업** — JSON 수동 내보내기/가져오기
- **디버그** — 저장된 파일 확인 / 전체 삭제
- **사용 가이드** — `/guide` 페이지로 이동

---

## 6. SNS 인증 (WebAuth)

Instagram/X 로그인 시 앱 내 WebView를 열어 사용자가 SNS 사이트에 로그인하면 쿠키를 추출하여 로컬에 저장한다.

- **저장 위치**: `@capacitor/preferences` (`cookies_instagram`, `cookies_x`)
- **사용 시점**: `/api/fetch` 호출 시 `cookies` 필드로 전달
- **보안**: 네이티브 앱 내부 저장, 서버에 영구 저장하지 않음
- **구현**: `WebAuth` 네이티브 Capacitor 플러그인 (`WebAuthActivity.java`)

---

## 7. 미디어 저장 방식

| 유형 | 파일 저장 위치 | 썸네일 | 원본 접근 |
|---|---|---|---|
| 다운로드 | 기기 갤러리 (`MediaManager/`) | 로컬 파일 | 로컬 파일 |
| 북마크 | 첫 장만 `MediaManager/`에 저장 | 로컬 파일 | 백엔드 프록시 스트리밍 |
| 갤러리 등록 | 기기 갤러리 (기존 파일) | 갤러리 파일 | 로컬 파일 |

다운로드 시 직접 CDN → 앱 대신 백엔드 `/api/proxy`를 거쳐 다운로드 (IP 불일치 우회).

---

## 8. 데이터 모델

### media_groups 테이블
```sql
CREATE TABLE media_groups (
  id TEXT PRIMARY KEY,
  sourceUrl TEXT,
  platform TEXT NOT NULL,        -- instagram | x | tiktok | youtube | camera | other
  mode TEXT NOT NULL,            -- download | bookmark | gallery
  thumbnailPath TEXT,
  totalCount INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  registeredAt TEXT NOT NULL
);
```

### media_items 테이블
```sql
CREATE TABLE media_items (
  id TEXT PRIMARY KEY,
  groupId TEXT NOT NULL,
  filePath TEXT,                 -- 다운로드/갤러리 등록만
  remoteUrl TEXT,                -- 북마크 스트리밍용
  type TEXT NOT NULL,            -- image | video
  itemIndex INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (groupId) REFERENCES media_groups(id) ON DELETE CASCADE
);
```

> **주의**: `PRAGMA foreign_keys`가 기본 OFF이므로 CASCADE가 자동 작동하지 않는다.
> `deleteGroup`, `deleteTag` 등에서 수동으로 관련 레코드 삭제 처리.

### tags 테이블
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 0,       -- 현재 연결된 그룹 수
  createdAt TEXT NOT NULL
);
```

`count` 갱신 시점:
- 그룹 생성 시 → 연결된 태그 count +1
- 그룹 삭제 시 → 연결된 태그 count -1 (MAX 0)
- 태그 편집 저장 시 → 추가된 태그 +1, 제거된 태그 -1

### group_tags 테이블
```sql
CREATE TABLE group_tags (
  groupId TEXT NOT NULL,
  tagId TEXT NOT NULL,
  PRIMARY KEY (groupId, tagId),
  FOREIGN KEY (groupId) REFERENCES media_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
);
```

### 백업 파일 형식 (JSON)
```json
{
  "version": 2,
  "exportedAt": "2026-05-03T10:00:00Z",
  "media_groups": [ ...groups 배열... ],
  "media_items": [ ...items 배열... ],
  "tags": [ ...tags 배열... ]
}
```

---

## 9. 태그 관리

- **태그 전체 목록**: ManagePage의 全 버튼 → TagListSheet (우측 슬라이드)
  - 초성별 섹션 분류 + 오른쪽 초성 바로가기
  - 각 태그 행: 태그명 | count 뱃지 | 🗑️ 삭제 버튼
- **태그 삭제 동작**:
  - `count === 0`: 확인 없이 즉시 삭제
  - `count > 0`: "'[태그명]' 태그가 N개 항목에서 제거됩니다. 삭제할까요?" 확인 후 삭제
  - 삭제 시 해당 태그가 붙은 모든 항목에서 태그가 제거됨 (항목 자체는 유지)

---

## 10. 주요 흐름

### ① SNS 다운로드 (다운로드 모드)
```
URL 입력 → 백엔드 /api/fetch 호출 (쿠키 포함)
→ carousel 미리보기
→ 모드: 다운로드 선택
→ 태그 입력
→ /api/proxy 경유 갤러리 저장
→ media_groups + media_items SQLite 등록
→ 관리 목록에 1개 묶음으로 표시
```

### ② SNS 북마크 (북마크 모드)
```
URL 입력 → 백엔드 /api/fetch 호출
→ carousel 미리보기
→ 모드: 북마크 선택
→ 태그 입력
→ 첫 번째 썸네일만 /api/proxy 경유 저장
→ media_groups + media_items (remoteUrl) SQLite 등록
→ 관리 목록에 1개 묶음 표시
```

### ③ 공유받기 (다른 앱 → 우리 앱)
```
SNS 앱에서 공유 → 우리 앱 선택 (Android SEND 인텐트)
→ ShareReceiverPlugin이 URL 캡처
→ 다운로드 화면 자동 오픈 + URL 자동 입력
→ ① 또는 ② 흐름과 동일
```

### ④ 미관리 → 관리 등록
```
미관리 목록 탭 진입 → 갤러리 스캔
→ 미등록 사진/영상 표시
→ 항목 탭으로 다중 선택
→ 태그 입력 후 저장
→ 관리 목록에 추가, 미관리 목록에서 제거
```

### ⑤ 바텀 시트 조작
```
목록 항목 탭 → 바텀 시트 오픈
→ 좌우 스와이프로 carousel 탐색
→ 현재 미디어만 삭제 → totalCount 갱신
→ 마지막 항목 삭제 시 → 그룹 전체 삭제
```

### ⑥ 롱프레스 빠른 메뉴
```
목록 항목 롱프레스 → 팝업 메뉴
→ 출처 열기: SNS URL을 브라우저로 오픈
→ 태그 편집: 태그 추가/제거 (count 자동 갱신)
→ 전체 삭제: 그룹 + media_items + group_tags 삭제, 태그 count 갱신
```

### ⑦ 태그 삭제
```
태그 전체 목록 열기 → 삭제할 태그 행의 🗑️ 버튼 탭
→ count=0이면 즉시 삭제
→ count>0이면 확인 다이얼로그 → 확인 시 삭제
→ 연결된 모든 group_tags 레코드 삭제 (항목은 유지)
```

### ⑧ 백업/복원
```
[내보내기]
설정 → "백업 내보내기" → JSON 파일 생성 → 공유 다이얼로그

[가져오기]
설정 → "백업 가져오기" → JSON 파일 선택
→ 기존 로컬 데이터 삭제 후 복원
→ 관리 목록 자동 갱신
```

---

## 11. 출처(플랫폼) 자동 감지 규칙

| URL 패턴 | 플랫폼 |
|---|---|
| `instagram.com` | instagram |
| `x.com` / `twitter.com` | x |
| `tiktok.com` | tiktok |
| `youtube.com` / `youtu.be` | youtube |
| 갤러리 등록 | camera |
| 그 외 | other |
