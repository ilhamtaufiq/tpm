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
                primary: "#00AA13", // Gojek Green like
                secondary: "#EE2737",
                background: "#F9F9F9",
                surface: "#FFFFFF",
                text: "#1C1C1C",
                textGray: "#767676",
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
