import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Project } from '~/types/project'
import { storage } from '~/utils/storage'

export default defineEventHandler(async () => {
  try {
    // 确保目录存在
    const projectsPath = resolve(process.cwd(), storage.paths.PROJECTS)
    
    try {
      // 读取项目目录列表
      const projectDirs = await readdir(projectsPath, { withFileTypes: true })
      
      // 只获取目录
      const projectIds = projectDirs
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
      
      // 读取每个项目的信息
      const projects = await Promise.all(
        projectIds.map(async (projectId) => {
          try {
            const projectFiles = storage.getProjectFiles(projectId)
            const projectData = await readFile(projectFiles.PROJECT, 'utf-8')
            return JSON.parse(projectData) as Project
          } catch (error) {
            console.error(`Failed to read project ${projectId}:`, error)
            return null
          }
        })
      )
      
      // 过滤掉读取失败的项目
      return {
        projects: projects.filter((p): p is Project => p !== null)
      }
    } catch (error: unknown) {
      // 如果目录不存在，返回空列表
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return { projects: [] }
      }
      throw error
    }
  } catch (error) {
    console.error('Failed to list projects:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to list projects'
    })
  }
}) 