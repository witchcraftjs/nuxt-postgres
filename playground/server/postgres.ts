import {
	createPostgresDb,
	useServerLogger
} from "#imports"
import * as schema from "~~/db/schema.js"

export const {
	migrate,
	postgres
	// memoryStorage
} = createPostgresDb(schema, useServerLogger)
