import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db, sqlite } from '.'

// 执行迁移
console.log('Running migrations...')
migrate(db, { migrationsFolder: './server/db/migrations' })
console.log('Migrations completed')

// 关闭数据库连接
sqlite.close() 