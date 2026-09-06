/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#023C69',
        accent: '#EE2737',
      },
      // Google Sans trio: Display = hero/heading, Text = body, Code = angka/kode.
      fontFamily: {
        sans: ['"Google Sans Text"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Google Sans Display"', '"Google Sans Text"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Google Sans Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}

