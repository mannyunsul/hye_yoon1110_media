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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeTab = computed(() => route.path.replace('/', '') || 'manage')
</script>
