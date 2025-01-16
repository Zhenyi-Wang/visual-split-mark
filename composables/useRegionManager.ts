import { ref } from 'vue'
import type { Region } from '~/types/audio'

export function useRegionManager() {
  const regions = ref<Map<string, Region>>(new Map())

  // 添加区域
  const addRegion = (annotation: Region & { id: string }) => {
    regions.value.set(annotation.id, annotation)
    return true
  }

  // 更新区域
  const updateRegion = (annotation: Region & { id: string }) => {
    if (!regions.value.has(annotation.id)) {
      return false
    }
    regions.value.set(annotation.id, annotation)
    return true
  }

  // 删除区域
  const removeRegion = (id: string) => {
    return regions.value.delete(id)
  }

  // 清空所有区域
  const clearRegions = () => {
    regions.value.clear()
    return true
  }

  // 获取区域
  const getRegion = (id: string) => {
    return regions.value.get(id)
  }

  // 获取所有区域
  const getAllRegions = () => {
    return regions.value
  }

  // 检查区域是否存在
  const hasRegion = (id: string) => {
    return regions.value.has(id)
  }

  // 获取区域数量
  const getRegionCount = () => {
    return regions.value.size
  }

  // 获取指定时间点所在的区域
  const findRegionByTime = (time: number) => {
    for (const [id, region] of regions.value.entries()) {
      if (time >= region.start && time <= region.end) {
        return { id, ...region }
      }
    }
    return null
  }

  // 获取与时间范围重叠的区域
  const findOverlappingRegions = (start: number, end: number) => {
    const overlapping = new Map<string, Region>()
    for (const [id, region] of regions.value.entries()) {
      if (
        (region.start >= start && region.start <= end) ||
        (region.end >= start && region.end <= end) ||
        (region.start <= start && region.end >= end)
      ) {
        overlapping.set(id, region)
      }
    }
    return overlapping
  }

  // 检查是否有重叠区域
  const hasOverlappingRegions = (start: number, end: number, excludeId?: string) => {
    for (const [id, region] of regions.value.entries()) {
      if (excludeId && id === excludeId) continue
      if (
        (region.start >= start && region.start <= end) ||
        (region.end >= start && region.end <= end) ||
        (region.start <= start && region.end >= end)
      ) {
        return true
      }
    }
    return false
  }

  // 合并重叠区域
  const mergeOverlappingRegions = (ids: string[]) => {
    const regionsToMerge = ids
      .map(id => regions.value.get(id))
      .filter((region): region is Region => region !== undefined)

    if (regionsToMerge.length < 2) return null

    const start = Math.min(...regionsToMerge.map(r => r.start))
    const end = Math.max(...regionsToMerge.map(r => r.end))
    const text = regionsToMerge.map(r => r.text).filter(Boolean).join(' ')

    // 删除原始区域
    ids.forEach(id => regions.value.delete(id))

    return { start, end, text }
  }

  // 分割区域
  const splitRegion = (id: string, time: number) => {
    const region = regions.value.get(id)
    if (!region || time <= region.start || time >= region.end) {
      return false
    }

    // 创建两个新区域
    const region1: Region = {
      start: region.start,
      end: time,
      text: region.text
    }

    const region2: Region = {
      start: time,
      end: region.end,
      text: region.text
    }

    // 删除原始区域并添加新区域
    regions.value.delete(id)
    regions.value.set(id + '_1', region1)
    regions.value.set(id + '_2', region2)

    return true
  }

  return {
    regions,
    addRegion,
    updateRegion,
    removeRegion,
    clearRegions,
    getRegion,
    getAllRegions,
    hasRegion,
    getRegionCount,
    findRegionByTime,
    findOverlappingRegions,
    hasOverlappingRegions,
    mergeOverlappingRegions,
    splitRegion
  }
} 