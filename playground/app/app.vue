<template>
<button @click="ping">
	Ping Database
</button>
<div>
	Exists: {{ res }}
</div>
</template>

<script setup>
const res = ref("")
async function ping() {
	res.value = await $fetch("/api/ping", {
		metthod: "GET"
	}).catch(err => err.message)
}
</script>
