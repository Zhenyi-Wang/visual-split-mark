import { setup } from '@css-render/vue3-ssr'
import { defineNuxtPlugin } from '#app'
import type { NuxtSSRContext } from '#app'
import {
  create,
  NButton,
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
  NTag
} from 'naive-ui'

export default defineNuxtPlugin((nuxtApp) => {
  const naive = create({
    components: [
      NButton,
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
      NTag
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
}) 