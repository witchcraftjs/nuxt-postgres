import { useGlobalClientDatabaseManager } from "./useGlobalClientDatabaseManager"

import type { ClientDatabaseManager } from "../utils/clientDatabaseManager"

/**
 * Closes and removes the database from the list of known databases.
 *
 * This does NOT delete the database, see `deleteIndexedDbDb` for that.
 */

export async function useRemoveClientDb(...args: Parameters<ClientDatabaseManager["removeDb"]>): Promise<void> {
	return useGlobalClientDatabaseManager().removeDb(...args)
}
