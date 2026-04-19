import { drizzle } from 'drizzle-orm/bun-sqlite'
import dotenv from 'dotenv'

dotenv.config()

export const db = drizzle(process.env.DATABASE_URL || 'data/db.db')
