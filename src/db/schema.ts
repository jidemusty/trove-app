// Better Auth tables (user, session, account, verification) — generated into
// auth-schema.ts by the Better Auth CLI. Re-exported here so drizzle-kit and
// db.query pick them up alongside the app tables added in later phases
// (categories, links, link_category, share).
export * from './auth-schema'

// App tables (categories now; links / link_category / share in later phases).
export * from './app-schema.ts'
