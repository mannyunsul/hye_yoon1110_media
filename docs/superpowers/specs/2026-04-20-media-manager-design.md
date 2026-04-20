# 미디어 매니저 앱 설계 문서

**작성일**: 2026-04-20  
**상태**: 승인됨

---

## 1. 프로젝트 개요

SNS에서 이미지/영상을 다운로드하거나 URL만 북마크로 저장하고, 기기 갤러리의 미디어까지 통합 관리하는 모바일 앱.  
태그, 출처 URL, 플랫폼 정보를 메타데이터로 관리하며 OneDrive를 통해 자동 백업된다.

---

## 2. 기술 스택

| 영역 | 기술 |
|---|---|
| 모바일 앱 | Quasar Framework (Vue 3) + Capacitor |
| 백엔드 | Node.js + yt-dlp (Railway 호스팅) |
| 로컬 DB | SQLite (Capacitor SQLite 플러그인) |
| 클라우드 백업 | Microsoft OneDrive (Graph API) |
| 미디어 저장 | 기기 갤러리 → OneDrive 자동 백업 (기존 설정) |

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
┌─────────────────────┐
│  백엔드 (Railway)    │
│  Node.js + yt-dlp   │
│  - 미디어 URL 추출   │
│  - 프록시 스트리밍   │
└─────────────────────┘

┌──────────────────────────┐
│  기기 저장소              │
│  - 갤러리 (이미지/영상)   │ ──→ OneDrive 자동 백업 (기존)
│  - 앱 내부 캐시 (썸네일)  │
│  - SQLite (메타데이터)    │
└──────────────────────────┘
             │ 자동 동기화 (Graph API)
             ▼
┌──────────────────────────┐
│  OneDrive                │
│  /MediaManager/          │
│    metadata.json         │
└──────────────────────────┘
```

---

## 4. 백엔드 설계

### 역할
- yt-dlp로 SNS URL에서 미디어 직접 URL 추출
- 미디어 프록시 스트리밍
- 플랫폼 자동 감지

### API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/fetch` | POST | URL → 미디어 그룹 정보 + 전체 미디어 URL 반환 |
| `/api/proxy` | GET | 미디어 프록시 스트리밍 |
| `/api/health` | GET | 서버 상태 확인 |

### 응답 형식
```json
{
  "success": true,
  "platform": "instagram",
  "sourceUrl": "https://instagram.com/p/xxx",
  "media": [
    { "url": "...", "type": "image", "index": 0 },
    { "url": "...", "type": "image", "index": 1 },
    { "url": "...", "type": "image", "index": 2 }
  ]
}
```

### 지원 플랫폼
yt-dlp 기반으로 1000개 이상 사이트 자동 지원.  
주요 플랫폼: Instagram, X(Twitter), TikTok, YouTube, Facebook 등

### 주의사항
- Instagram은 서버 IP 차단 가능 → 로그인 세션 연결 필요할 수 있음
- yt-dlp는 URL 추출만 담당, 파일 다운로드는 앱에서 직접 수행 (서버 부하 최소화)

---

## 5. 앱 화면 구조

하단 탭 4개 구성. **페이지 이동 없이 바텀 시트**로 상세 정보 표시.

### 탭1 — 관리 목록
- 상단 검색창
- 가로 스크롤 태그 필터바 (사용 빈도순 정렬) + 全 버튼
- 플랫폼 필터 (전체 / Instagram / X / TikTok / ...)
- 갤러리 그리드 뷰 — **1 URL = 1 묶음 항목**으로 표시
  - 대표 썸네일 (첫 번째 이미지) + 개수 뱃지 (예: `🖼️ 1/5`)
  - 북마크 항목은 `🔖` 뱃지로 구분
- **탭**: 바텀 시트 열림 (페이지 이동 없음)
- **롱프레스**: 빠른 메뉴 팝업 (출처 열기 / 태그 편집 / 전체 삭제)
- 全 버튼 → 태그 전체 목록 (초성별 섹션 + 오른쪽 초성 바로가기, 개수 표시)

> 초성 바로가기 UI는 실제 화면 보고 최종 확정 예정

### 바텀 시트 (관리 목록 항목 탭 시)
- 현재 화면 위에 아래에서 위로 슬라이드 오픈 (페이지 이동 아님)
- 미디어 좌우 스와이프 (carousel 전체 탐색)
- 현재 인덱스 표시 (예: `2 / 5`)
- 플랫폼 뱃지 + 출처 URL 바로가기 버튼
- 태그 목록 + 태그 추가/삭제
- **현재 미디어만 삭제** 버튼
- 바깥 탭 또는 아래로 스와이프 → 닫힘

### 탭2 — 미관리 목록
- Capacitor MediaStore 플러그인으로 기기 갤러리 전체 파일 경로 스캔
- SQLite media_items 테이블에 없는 filePath → 미관리 목록으로 표시
- 탭 진입 시 스캔 실행 (앱 시작 시 백그라운드 스캔도 병행)
- 선택 (다중 선택 가능) → 태그 입력 → 저장 → 관리 목록으로 이동, 미관리에서 제거
- 관리 목록에서 태그 전부 삭제 시 다시 미관리로 복귀

### 탭3 — 다운로드
- **두 가지 모드** 선택:
  - **다운로드 모드**: 갤러리에 파일 저장 + 메타데이터 등록
  - **북마크 모드**: 파일 저장 없이 URL + 썸네일만 등록
- URL 직접 입력 또는 다른 앱에서 공유받기 (공유 인텐트 처리)
- 미디어 미리보기 (carousel은 좌우 스와이프)
- 태그 및 출처 URL 자동 입력 (수정 가능)

### 탭4 — 설정
- OneDrive 연결 / 해제
- 자동 동기화 토글
- 백업 내보내기 (JSON 파일)
- 백업 가져오기 (JSON 파일)
- 백엔드 서버 URL 설정

---

## 6. 미디어 저장 방식

| 유형 | 파일 저장 위치 | 썸네일 | 원본 접근 |
|---|---|---|---|
| 다운로드 | 기기 갤러리 | 갤러리 파일 사용 | 로컬 파일 |
| 북마크 | 저장 안 함 | 앱 내부 캐시 (첫 장만) | 실시간 스트리밍 |
| 갤러리 등록 | 기기 갤러리 (기존 파일) | 갤러리 파일 사용 | 로컬 파일 |

- 북마크 썸네일: 첫 번째 미디어만 앱 내부 캐시에 저장 (~5~20KB)
- carousel 나머지 미디어: 바텀 시트에서 스와이프 시 실시간 스트리밍

---

## 7. 데이터 모델

### media_groups 테이블 (묶음 단위, 목록에 1행으로 표시)
```sql
CREATE TABLE media_groups (
  id TEXT PRIMARY KEY,           -- UUID
  sourceUrl TEXT,                -- 출처 URL (SNS 원본 링크)
  platform TEXT NOT NULL,        -- instagram | x | tiktok | youtube | camera | other
  mode TEXT NOT NULL,            -- download | bookmark | gallery
  thumbnailPath TEXT,            -- 대표 썸네일 경로 (첫 번째 미디어)
  totalCount INTEGER DEFAULT 1,  -- 전체 미디어 수
  createdAt TEXT NOT NULL,
  registeredAt TEXT NOT NULL
);
```

### media_items 테이블 (개별 미디어)
```sql
CREATE TABLE media_items (
  id TEXT PRIMARY KEY,           -- UUID
  groupId TEXT NOT NULL REFERENCES media_groups(id) ON DELETE CASCADE,
  filePath TEXT,                 -- 갤러리 파일 경로 (다운로드/갤러리 등록만)
  remoteUrl TEXT,                -- 원격 URL (북마크 모드 스트리밍용)
  type TEXT NOT NULL,            -- image | video
  itemIndex INTEGER NOT NULL,    -- carousel 내 순서 (0부터)
  createdAt TEXT NOT NULL
);
```

### tags 테이블
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 0,       -- 사용 중인 그룹 수
  createdAt TEXT NOT NULL
);
```

### group_tags 테이블 (그룹-태그 다대다)
```sql
CREATE TABLE group_tags (
  groupId TEXT NOT NULL REFERENCES media_groups(id) ON DELETE CASCADE,
  tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (groupId, tagId)
);
```

### OneDrive 백업 파일 (`/MediaManager/metadata.json`)
```json
{
  "version": 2,
  "exportedAt": "2026-04-20T10:00:00Z",
  "media_groups": [ ...groups 배열... ],
  "media_items": [ ...items 배열... ],
  "tags": [ ...tags 배열... ]
}
```

---

## 8. 주요 흐름

### ① SNS 다운로드 (다운로드 모드)
```
URL 입력 → 백엔드 /api/fetch 호출
→ carousel 미리보기 (좌우 스와이프)
→ 모드 선택: 다운로드
→ 태그 입력
→ 전체 미디어 갤러리 저장
→ media_groups + media_items SQLite 등록
→ OneDrive 자동 동기화
→ 관리 목록에 1개 묶음으로 표시
```

### ② SNS 북마크 (북마크 모드)
```
URL 입력 → 백엔드 /api/fetch 호출
→ carousel 미리보기
→ 모드 선택: 북마크
→ 태그 입력
→ 첫 번째 썸네일만 앱 내부 캐시 저장
→ media_groups + media_items (remoteUrl만) SQLite 등록
→ OneDrive 자동 동기화
→ 관리 목록에 1개 묶음 (🔖 뱃지)으로 표시
```

### ③ 공유받기 (다른 앱 → 우리 앱)
```
SNS 앱에서 공유 → 우리 앱 선택
→ URL 자동 캡처 + 다운로드 화면 오픈
→ ① 또는 ② 흐름과 동일하게 진행
```

### ④ 미관리 → 관리 등록
```
미관리 목록에서 미디어 선택 (다중 선택 가능)
→ 태그 입력 (출처 URL 선택적 입력)
→ 저장 → 관리 목록으로 이동
→ 미관리 목록에서 제거
→ OneDrive 자동 동기화
```

### ⑤ 바텀 시트 조작
```
목록 항목 탭 → 바텀 시트 오픈
→ 좌우 스와이프로 carousel 탐색
→ 출처 URL 탭 → SNS 앱 오픈
→ 현재 미디어만 삭제 → media_items에서 제거, totalCount 갱신
→ 마지막 항목 삭제 시 → media_groups도 제거, 목록에서 사라짐
→ 바깥 탭 / 아래 스와이프 → 닫힘
```

### ⑥ 롱프레스 빠른 메뉴
```
목록 항목 롱프레스 → 팝업 메뉴
→ 출처 열기: SNS 앱 오픈
→ 태그 편집: 태그 수정 다이얼로그
→ 전체 삭제: media_groups + 하위 media_items 전체 삭제
```

### ⑦ OneDrive 동기화
```
메타데이터 변경 발생 (다운로드/태그 수정/삭제 등)
→ 백그라운드에서 자동으로 OneDrive /MediaManager/metadata.json 업데이트
```

### ⑧ 기기 이전
```
[OneDrive 연결된 경우]
새 폰 설치 → OneDrive 로그인 → metadata.json 자동 복원

[수동 백업]
설정 → 백업 내보내기 → JSON 파일 생성
→ 카카오톡/이메일/구글드라이브 등으로 전송
→ 새 폰에서 설정 → 백업 가져오기
```

---

## 9. OneDrive 연동 정책

- OneDrive는 **선택 사항** — 미연결 시 모든 핵심 기능 정상 동작
- 연결 시: 메타데이터 자동 실시간 동기화
- 미연결 시: 로컬 SQLite만 사용, 수동 백업 가능
- Microsoft Azure 앱 등록 필요 (무료, 1회)

---

## 10. 출처(플랫폼) 자동 감지 규칙

| URL 패턴 | 플랫폼 |
|---|---|
| `instagram.com` | instagram |
| `x.com` / `twitter.com` | x |
| `tiktok.com` | tiktok |
| `youtube.com` / `youtu.be` | youtube |
| `facebook.com` | facebook |
| 카메라 촬영 | camera |
| 그 외 | other |
