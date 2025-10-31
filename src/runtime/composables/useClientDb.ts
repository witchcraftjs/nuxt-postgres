import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy"
import type { PgliteDatabase } from "drizzle-orm/pglite"

import { useGlobalClientDatabaseManager } from "./useGlobalClientDatabaseManager.js"

import type { LocalPgDbTypes } from "../types.js"
import type { AllOptions, InitOptions } from "../utils/clientDatabaseManager.js"

export async function useClientDb<
	TName extends keyof LocalPgDbTypes | string,
	TDb extends TName extends keyof LocalPgDbTypes ? LocalPgDbTypes[TName] : (PgliteDatabase | PgRemoteDatabase)
>(
	name: TName | undefined,
	opts?: AllOptions, // do not define this or init will break
	initOpts: InitOptions = {}
):
Promise<TDb> {
	return useGlobalClientDatabaseManager().useClientDb(name, opts, initOpts) as any
}

