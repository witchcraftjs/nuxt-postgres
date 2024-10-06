import { ClientDatabaseManager } from "../utils/clientDatabaseManager.js"

if (import.meta.server) {
	throw new Error("useGlobalClientDatabaseManager should only be used in the server.")
}
let globalState
export function useGlobalClientDatabaseManager(): ClientDatabaseManager {
	globalState ??= new ClientDatabaseManager()
	return globalState
}
