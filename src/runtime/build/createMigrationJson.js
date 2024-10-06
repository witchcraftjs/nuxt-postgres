import { readMigrationFiles } from "drizzle-orm/migrator"
import fs from "fs"
import path from "path"

//
const folder = process.argv[2] ?? path.resolve(process.cwd(), "db/client-migrations")
const jsonPath = path.resolve(folder, "clientMigration.json")

const migrations = readMigrationFiles({
	migrationsFolder: folder
})

// eslint-disable-next-line no-console
console.log(`Writing migrations to: ${jsonPath}`)
fs.writeFileSync(jsonPath, JSON.stringify(migrations))
