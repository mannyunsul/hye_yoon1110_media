<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { initDB } from './stores/db'

const $q = useQuasar()

$q.notify.setDefaults({
  position: 'top',
  timeout: 3000,
})

onMounted(async () => {
  await initDB()
})
</script>
