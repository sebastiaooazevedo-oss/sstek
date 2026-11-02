/** @type {import('tailwindcss').Config} */

const scale = (name) => ({
  50: `oklch(var(--${name}-50) / <alpha-value>)`,
  100: `oklch(var(--${name}-100) / <alpha-value>)`,
  200: `oklch(var(--${name}-200) / <alpha-value>)`,
  300: `oklch(var(--${name}-300) / <alpha-value>)`,
  400: `oklch(var(--${name}-400) / <alpha-value>)`,
  500: `oklch(var(--${name}-500) / <alpha-value>)`,
  600: `oklch(var(--${name}-600) / <alpha-value>)`,
  700: `oklch(var(--${name}-700) / <alpha-value>)`,
  800: `oklch(var(--${name}-800) / <alpha-value>)`,
  900: `oklch(var(--${name}-900) / <alpha-value>)`,
  950: `oklch(var(--${name}-950) / <alpha-value>)`,
});

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: scale("background"),
        foreground: scale("foreground"),
        primary: scale("primary"),
        accent: scale("accent"),
        secondary: scale("secondary"),
        /**
         * Escala semântica de risco (vermelho), pedida explicitamente para a
         * sinalização de documentos vencidos. Não é uma marca: só representa
         * atraso/pendência crítica.
         */
        danger: scale("danger"),
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-heading)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-heading)", "ui-sans-serif", "system-ui", "sans-serif"],
        label: ["var(--font-label)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};