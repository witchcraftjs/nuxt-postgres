import { PGlite } from "@electric-sql/pglite"
import { worker } from "@electric-sql/pglite/worker"

void worker({
	async init(options) {
		const meta = options.meta
		return new PGlite(options.dataDir, meta.options)
	}
})
