import { setup } from '@css-render/vue3-ssr'
import { defineNuxtPlugin } from '#app'
import type { NuxtSSRContext } from '#app'
import {
  create,
  NButton,
  NButtonGroup,
  NDivider,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NH1,
  NH2,
  NConfigProvider,
  NLoadingBarProvider,
  NDialogProvider,
  NNotificationProvider,
  NMessageProvider,
  NSpace,
  NCard,
  NEmpty,
  NIcon,
  NSwitch,
  NRadio,
  NRadioGroup,
  NProgress,
  NList,
  NListItem,
  NThing,
  NText,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NScrollbar,
  NUpload,
  NPageHeader,
  NTag,
  NResult,
  NSpin,
  NDescriptions,
  NDescriptionsItem
} from 'naive-ui'

// 导入图标组件
import { Play, Pause } from '@vicons/carbon'

export default defineNuxtPlugin((nuxtApp) => {
  const naive = create({
    components: [
      NButton,
      NButtonGroup,
      NDivider,
      NLayout,
      NLayoutHeader,
      NLayoutContent,
      NH1,
      NH2,
      NConfigProvider,
      NLoadingBarProvider,
      NDialogProvider,
      NNotificationProvider,
      NMessageProvider,
      NSpace,
      NCard,
      NEmpty,
      NIcon,
      NSwitch,
      NRadio,
      NRadioGroup,
      NProgress,
      NList,
      NListItem,
      NThing,
      NText,
      NModal,
      NForm,
      NFormItem,
      NInput,
      NInputNumber,
      NScrollbar,
      NUpload,
      NPageHeader,
      NTag,
      NResult,
      NSpin,
      NDescriptions,
      NDescriptionsItem
    ]
  })

  nuxtApp.vueApp.use(naive)

  // Setup CSS SSR
  if (process.server) {
    const { collect } = setup(nuxtApp.vueApp)
    const originalRenderMeta = nuxtApp.ssrContext?.renderMeta
    if (nuxtApp.ssrContext) {
      nuxtApp.ssrContext.renderMeta = () => {
        if (!originalRenderMeta) {
          return {
            headTags: collect()
          }
        }
        const originalMeta = typeof originalRenderMeta === 'function' 
          ? originalRenderMeta() 
          : {}
        if ('headTags' in originalMeta) {
          originalMeta.headTags += collect()
        } else {
          originalMeta.headTags = collect()
        }
        return originalMeta
      }
    }
  }

  // 注册图标组件
  nuxtApp.vueApp.component('n-icon', NIcon)
  nuxtApp.vueApp.component('icon-play', Play)
  nuxtApp.vueApp.component('icon-pause', Pause)
}) 