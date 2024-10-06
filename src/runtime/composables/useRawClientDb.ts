import { useGlobalClientDatabaseManager } from "./useGlobalClientDatabaseManager.js"

import type { ClientDatabaseManager } from "../utils/clientDatabaseManager.js"

/**
 * Returns the raw underlying pglite database.
 *
 * This is useful for doing pglite specific actions. See also `deleteIndexedDbDb`.
 */
export async function useRawClientDb(...args: Parameters<ClientDatabaseManager["useRawClientDb"]>): Promise<ReturnType<ClientDatabaseManager["useRawClientDb"]>> {
	return useGlobalClientDatabaseManager().useRawClientDb(...args)
}
