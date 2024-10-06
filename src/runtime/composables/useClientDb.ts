import type { PgliteDatabase } from "drizzle-orm/pglite"

import { useGlobalClientDatabaseManager } from "./useGlobalClientDatabaseManager.js"

import type { ClientDatabaseManager } from "../utils/clientDatabaseManager.js"

export async function useClientDb(...args: Parameters<ClientDatabaseManager["useClientDb"]>): Promise<PgliteDatabase> {
	return useGlobalClientDatabaseManager().useClientDb(...args)
}
