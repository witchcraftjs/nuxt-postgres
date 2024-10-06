import { defineNitroPlugin } from "#imports"
import { postgres } from "#postgres"

export default defineNitroPlugin(nitroApp => {
	nitroApp.hooks.hook("request", event => {
		event.context.$postgres = postgres
	})
})
