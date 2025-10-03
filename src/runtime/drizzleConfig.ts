/**
 * Esm in drizzle is borked, so files it imports require weird exports paths.
 * This gets more complicated because during dev, nuxt modules are only stubbed so dist only contains ts files.
 *
 * Drizzle can import from ts files, but normally we wouldn't have that as an export and then that would probably cause issues with nuxt.
 *
 * Drizzle, weirdly enough, does this imports via require, so we can point our requires to the .ts files in src (since in dist they might or might not exist.)
 *
 * This affects every import, so nuxt-utils must also do this.
 */
// #awaiting https://github.com/drizzle-team/drizzle-orm/issues/1561
// https://github.com/drizzle-team/drizzle-orm/issues/2705
// https://github.com/drizzle-team/drizzle-orm/issues/849

import { ensureEnv } from "@witchcraft/nuxt-utils/utils/ensureEnv"
import type { Config } from "drizzle-kit"

ensureEnv(process.env, [
	"POSTGRES_HOST",
	"POSTGRES_USER",
	"POSTGRES_PASSWORD",
	"POSTGRES_NAME"
])

export const drizzleConfig: Config = {
	dialect: "postgresql",
	dbCredentials: {
		host: process.env.POSTGRES_HOST!,
		user: process.env.POSTGRES_USER!,
		password: process.env.POSTGRES_PASSWORD!,
		database: process.env.POSTGRES_NAME!
	},
	out: "./db/migrations"
}
