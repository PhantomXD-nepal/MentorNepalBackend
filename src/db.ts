import { drizzle } from 'drizzle-orm/better-sqlite3'
import dotenv from 'dotenv'

dotenv.config()

export const db = drizzle(process.env.DATABASE_URL || './data/mentornepal.db')