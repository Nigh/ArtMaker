<script lang="ts">
	import { onMount } from "svelte"

	// Matches @xianii/design-system: dark = "xianii", light = "xianii-light"
	type Theme = "xianii" | "xianii-light"
	const THEME_KEY = "theme"

	let theme: Theme = "xianii"

	const applyTheme = (nextTheme: Theme) => {
		theme = nextTheme
		document.documentElement.setAttribute("data-theme", nextTheme)
		localStorage.setItem(THEME_KEY, nextTheme)
	}

	const normalize = (value: string | null): Theme | null => {
		if (value === "xianii" || value === "xianii-light") return value
		// legacy name from pre-design-system template
		if (value === "xianii-dark") return "xianii"
		return null
	}

	onMount(() => {
		const savedTheme = normalize(localStorage.getItem(THEME_KEY))
		if (savedTheme) {
			applyTheme(savedTheme)
			return
		}

		const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
		applyTheme(systemPrefersDark ? "xianii" : "xianii-light")
	})

	const toggleTheme = () => {
		applyTheme(theme === "xianii-light" ? "xianii" : "xianii-light")
	}
</script>

<button
	class="btn btn-sm btn-outline fixed top-4 right-4 z-50"
	type="button"
	on:click={toggleTheme}
	aria-label="Toggle theme"
>
	{theme === "xianii-light" ? "🌙 Dark" : "☀️ Light"}
</button>
