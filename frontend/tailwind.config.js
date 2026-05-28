/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                outfit: ["Outfit_400Regular"],
                "outfit-medium": ["Outfit_500Medium"],
                "outfit-semibold": ["Outfit_600SemiBold"],
                "outfit-bold": ["Outfit_700Bold"],
            },
            colors: {
                primary: "var(--color-primary)",
                secondary: "var(--color-secondary)",
                background: "var(--color-background)",
                surface: "var(--color-surface)",
                text: "var(--color-text)",
                textGray: "var(--color-text-gray)",
                gopayBlue: "#00ADEF",
            },
            borderRadius: {
                "2xl": "16px",
                "3xl": "24px",
            },
        },
    },
    plugins: [],
}
