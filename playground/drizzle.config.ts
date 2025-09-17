import { drizzleConfig } from "@witchcraft/nuxt-postgres/drizzleConfig"
import { defineConfig } from "drizzle-kit"
import path from "node:path"


export default defineConfig({
	...drizzleConfig,
	schema: path.resolve("db/schema.ts"),
	out: "./db/migrations"
})

