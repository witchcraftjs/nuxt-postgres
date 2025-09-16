export default defineEventHandler(event => {
	const postgresAvailable = event.context.$postgres!
	if (!postgresAvailable) throw new Error("Database not available.")
	return true
})
