<template>
  <q-layout view="lHh lpr lFf">
    <q-header>
      <div style="height: env(safe-area-inset-top); background: #1a1a1a;" />
    </q-header>

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
        @update:model-value="onTabChange"
      >
        <q-tab name="manage" icon="photo_library" label="관리" />
        <q-tab name="unmanaged" icon="folder_open" label="미관리" />
        <q-tab name="download" icon="download" label="다운로드" />
        <q-tab name="settings" icon="settings" label="설정" />
      </q-tabs>
      <div style="height: env(safe-area-inset-bottom); background: #1a1a1a;" />
    </q-footer>
  </q-layout>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const activeTab = ref(route.path.replace('/', '') || 'manage')

watch(() => route.path, (path) => {
  activeTab.value = path.replace('/', '') || 'manage'
})

function onTabChange(tab) {
  router.push('/' + tab)
}
</script>
