<template>
  <q-page class="bg-grey-10 q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat round icon="arrow_back" color="grey-4" @click="$router.back()" />
      <div class="text-h6 text-grey-3 q-ml-sm">📖 사용 가이드</div>
    </div>

    <q-expansion-item
      v-for="item in guides"
      :key="item.title"
      :label="item.title"
      header-class="text-grey-3 bg-grey-9"
      class="bg-grey-9 q-mb-sm rounded-borders"
      expand-icon-class="text-grey-4"
    >
      <q-card flat class="bg-grey-9">
        <q-card-section class="q-pt-none">
          <ol class="text-grey-4 q-pl-md q-ma-none">
            <li v-for="step in item.steps" :key="step" class="q-mb-xs text-caption">{{ step }}</li>
          </ol>
        </q-card-section>
      </q-card>
    </q-expansion-item>
  </q-page>
</template>

<script setup>
const guides = [
  {
    title: '① SNS 다운로드',
    steps: [
      'SNS에서 공유할 URL을 복사한다.',
      '다운로드 탭을 연다.',
      'URL 입력 후 "가져오기" 버튼을 누른다.',
      '다운로드 / 북마크 모드를 선택한다.',
      '미리보기 확인 후 "저장" 버튼을 누른다.',
      '관리 목록 탭에서 저장된 항목을 확인한다.',
    ],
  },
  {
    title: '② 바텀 시트로 미디어 보기',
    steps: [
      '관리 목록에서 썸네일을 탭한다.',
      '화면 하단에서 바텀 시트가 올라온다.',
      '좌우로 스와이프해 같은 묶음의 미디어를 탐색한다.',
      '개별 미디어 삭제 버튼으로 항목 하나만 삭제할 수 있다.',
      '아래로 스와이프하거나 배경 탭으로 닫는다.',
    ],
  },
  {
    title: '③ 롱프레스 퀵 메뉴',
    steps: [
      '관리 목록에서 썸네일을 길게 누른다.',
      '퀵 메뉴(출처 열기 / 태그 편집 / 전체 삭제)가 표시된다.',
      '"출처 열기"를 누르면 원본 SNS URL이 브라우저에서 열린다.',
      '"태그 편집"을 누르면 태그 입력 다이얼로그가 열린다.',
      '"전체 삭제"를 누르면 묶음 내 모든 미디어가 삭제된다.',
    ],
  },
  {
    title: '④ 미관리 → 관리 등록',
    steps: [
      '미관리 목록 탭을 연다.',
      '갤러리에서 등록되지 않은 사진/영상이 표시된다.',
      '등록할 항목을 탭하면 선택 표시가 나타난다.',
      '상단 "태그 등록" 버튼을 누르고 태그를 입력한 후 저장한다.',
      '관리 목록 탭에서 등록된 항목을 확인한다.',
    ],
  },
  {
    title: '⑤ 기기 이전 (백업/복원)',
    steps: [
      '기존 기기에서 설정 탭 → "백업 내보내기"를 누른다.',
      '공유 다이얼로그에서 KakaoTalk, 이메일 등으로 JSON 파일을 전송한다.',
      '새 기기에서 앱을 설치한다.',
      '설정 탭 → "백업 가져오기"를 누르고 전달받은 JSON 파일을 선택한다.',
      '복원 완료 후 관리 목록에서 항목을 확인한다.',
    ],
  },
]
</script>
