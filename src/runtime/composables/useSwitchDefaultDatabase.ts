import { useGlobalClientDatabaseManager } from "./useGlobalClientDatabaseManager"

import type { ClientDatabaseManager } from "../utils/clientDatabaseManager"

/**
 * Switches the default database to the name passed.
 *
 * The database must already exist unless you pass { errorIfNotFound: false }.
 *
 * See {@link ClientDatabaseManager.switchDefaultDatabase} for more info.
 */
export async function useSwitchDefaultDatabase(...args: Parameters<ClientDatabaseManager["switchDatabase"]>): Promise<void> {
	return useGlobalClientDatabaseManager().switchDatabase(...args)
}
