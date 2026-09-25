/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0b0f17",
          800: "#111827",
          700: "#1f2937",
          600: "#374151"
        },
        brand: {
          cyan: "#38bdf8",
          emerald: "#34d399",
          purple: "#a855f7",
          amber: "#f59e0b",
          red: "#ef4444"
        }
      }
    },
  },
  plugins: [],
}
