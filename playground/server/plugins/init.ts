import { defineNitroPlugin } from "#imports"
import { migrate, postgres } from "#postgres"

export default defineNitroPlugin(nitroApp => {
	console.log("Server plugin")
	// the module auto types the $postgres key (you can change the key name with the eventContextKeyName option)
	nitroApp.hooks.hook("request", event => {
		event.context.$postgres = postgres
	})

	// there's no way to await this yet
	// see https://github.com/nitrojs/nitro/issues/915
	void migrate({
		// initialization script
		// e.g. create extensions
		preMigrationScript: `CREATE EXTENSION IF NOT EXISTS pg_uuidv7;`
	})
})
