import { defineStore } from 'pinia';

// 백엔드 URL은 config.js에 하드코딩. 이 스토어는 UI 상태만 관리.
export const useSettingsStore = defineStore('settings', {
  state: () => ({}),
});
