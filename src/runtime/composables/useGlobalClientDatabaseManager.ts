import { ClientDatabaseManager } from "../utils/clientDatabaseManager.js"

let globalState
export function useGlobalClientDatabaseManager(): ClientDatabaseManager {
	if (import.meta.server) {
		throw new Error("useGlobalClientDatabaseManager should only be used on the client.")
	}
	globalState ??= new ClientDatabaseManager()
	return globalState
}
