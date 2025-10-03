import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy"
import type { PgliteDatabase } from "drizzle-orm/pglite"

import { useGlobalClientDatabaseManager } from "./useGlobalClientDatabaseManager.js"

import type { ClientDatabaseManager } from "../utils/clientDatabaseManager.js"

export async function useClientDb(...args: Parameters<ClientDatabaseManager["useClientDb"]>): Promise<PgliteDatabase | PgRemoteDatabase> {
	return useGlobalClientDatabaseManager().useClientDb(...args)
}
