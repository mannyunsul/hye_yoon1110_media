<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { initDB } from './stores/db'
import { useSharedUrl } from './composables/useSharedUrl'

const $q = useQuasar()
const router = useRouter()
const { init: initSharedUrl } = useSharedUrl()

$q.notify.setDefaults({
  position: 'top',
  timeout: 3000,
})

onMounted(async () => {
  await initDB()
  await initSharedUrl(router)
})
</script>
