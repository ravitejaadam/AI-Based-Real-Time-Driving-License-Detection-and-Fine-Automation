/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        secondary: "#1e293b",
        accent: "#ef4444",
        background: "#020617",
        surface: "#0f172a",
        card: "#1e293b",
      }
    },
  },
  plugins: [],
}
