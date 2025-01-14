# 组件文档

本文档详细介绍了 Visual Split Mark 项目中的所有组件。这些组件按功能分类，每个组件都有其特定的用途和职责。

## 组件目录结构

```
components/
├── audio/              # 音频相关组件
│   ├── AudioPlayer.vue    # 音频播放器
│   ├── WaveformView.vue   # 波形显示
│   └── Controls.vue       # 播放控制
├── project/            # 项目管理组件
│   ├── ProjectList.vue    # 项目列表
│   ├── ProjectCard.vue    # 项目卡片
│   └── ProjectForm.vue    # 项目表单
└── annotation/         # 标注相关组件
    ├── Editor.vue         # 标注编辑器
    ├── Timeline.vue       # 时间轴
    └── SegmentList.vue    # 片段列表
```

## 组件分类

1. **音频组件**
   - 负责音频播放和可视化
   - 提供波形显示和播放控制
   - 支持时间点定位和选择

2. **项目组件**
   - 管理项目的创建、编辑和删除
   - 显示项目列表和详情
   - 处理项目相关的表单操作

3. **标注组件**
   - 提供音频片段的标注功能
   - 管理时间轴和片段列表
   - 支持文本编辑和 Whisper 识别

## 组件通信

1. **Props 和 Events**
   - 使用 TypeScript 定义 Props 类型
   - 通过 Events 进行父子组件通信
   - 保持组件间的松耦合

2. **状态管理**
   - 使用 Pinia store 管理全局状态
   - 组件通过 store 共享数据
   - 保持状态的一致性

3. **组合式 API**
   - 使用 `setup` 语法
   - 提取可复用的逻辑
   - 保持代码的可维护性

## 组件开发规范

1. **命名规范**
   - 组件名使用 PascalCase
   - Props 使用 camelCase
   - Events 使用 kebab-case

2. **文件组织**
   - 每个组件一个文件
   - 相关组件放在同一目录
   - 使用 index.ts 导出

3. **代码风格**
   - 使用 TypeScript
   - 遵循 ESLint 规则
   - 编写注释和文档

## 详细文档

- [音频组件](./audio.md)
- [项目组件](./project.md)
- [标注组件](./annotation.md)

## 开发指南

1. **创建新组件**
   ```bash
   # 在相应目录创建组件文件
   touch components/category/ComponentName.vue
   ```

2. **组件模板**
   ```vue
   <script setup lang="ts">
   // 导入和类型定义
   import { ref, computed } from 'vue'
   import type { PropType } from 'vue'

   // Props 定义
   const props = defineProps<{
     // props 类型定义
   }>()

   // Emits 定义
   const emit = defineEmits<{
     // events 类型定义
   }>()

   // 组件逻辑
   </script>

   <template>
     <!-- 模板内容 -->
   </template>

   <style scoped>
   /* 样式定义 */
   </style>
   ```

3. **测试规范**
   - 编写单元测试
   - 进行组件测试
   - 确保测试覆盖率

## 最佳实践

1. **性能优化**
   - 使用 `v-show` 代替 `v-if`
   - 合理使用计算属性
   - 避免不必要的渲染

2. **可访问性**
   - 添加 ARIA 属性
   - 支持键盘操作
   - 考虑色彩对比度

3. **错误处理**
   - 优雅降级
   - 提供错误提示
   - 记录错误日志

## 贡献指南

1. **开发流程**
   - Fork 项目
   - 创建特性分支
   - 提交 Pull Request

2. **代码审查**
   - 遵循代码规范
   - 编写测试用例
   - 更新文档

3. **版本控制**
   - 语义化版本号
   - 更新日志
   - 发布说明 