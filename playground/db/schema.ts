// careful, we can't use nuxt paths because of drizzle
import { pgTable, uuid } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
	id: uuid("id").primaryKey().unique()
		.notNull()
})

