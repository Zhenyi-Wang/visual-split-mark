<template>
  <naive-provider>
    <n-layout>
      <n-layout-header bordered>
        <div class="header-content">
          <n-h2>Visual Split Mark</n-h2>
          <n-button text @click="navigateTo('/')">项目列表</n-button>
        </div>
      </n-layout-header>
      <n-layout-content>
        <slot></slot>
      </n-layout-content>
    </n-layout>
  </naive-provider>
</template>

<script setup lang="ts">
</script>

<style scoped>
.header-content {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}
</style> 