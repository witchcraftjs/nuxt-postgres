/**
	* See notes for ./drizzleConfig.ts as they also apply here.
 */

import type { Config } from "drizzle-kit"

export const drizzleConfig: Config = {
	dialect: "postgresql",
	driver: "pglite",
	dbCredentials: {
		url: "idb://..."
	},
	out: "./db/client-migrations"
}
