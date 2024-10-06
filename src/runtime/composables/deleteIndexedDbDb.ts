import { useGlobalClientDatabaseManager } from "./useGlobalClientDatabaseManager.js"

import type { ClientDatabaseManager } from "../utils/clientDatabaseManager.js"

/**
 * Delete the client database (only indexedDB for now) and any migration state in it's storage.
 *
 * This is a hackish solution and page navigation is required for the db to get properly deleted.
 */
export async function deleteIndexedDbDb(...args: Parameters<ClientDatabaseManager["deleteIndexedDbDb"]>): Promise<ReturnType<ClientDatabaseManager["deleteIndexedDbDb"]>> {
	return useGlobalClientDatabaseManager().deleteIndexedDbDb(...args)
}
