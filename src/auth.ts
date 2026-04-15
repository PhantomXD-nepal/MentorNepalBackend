import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from './db'
import * as schemas from './schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: schemas,
  }),
  emailAndPassword: {
    requireEmailVerification: false,
    enabled: true,
  },
})
