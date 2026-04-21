<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { initDB } from './stores/db'

onMounted(async () => {
  await initDB()
})
</script>
