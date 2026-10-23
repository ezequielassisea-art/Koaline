/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
        },
        accent: 'var(--color-accent)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'surface-sunken': 'var(--color-surface-sunken)',
        'text-main': 'var(--color-text-main)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
      },
      borderRadius: {
        'nest': 'var(--radius-nest, 16px)',
        'nest-sm': 'var(--radius-nest-sm, 10px)',
        'nest-lg': 'var(--radius-nest-lg, 24px)',
        'nest-pill': '9999px',
      },
      boxShadow: {
        'nest': '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
        'nest-elevated': '0 20px 45px -8px rgba(0, 0, 0, 0.45)',
        'glow-primary': '0 0 25px -4px rgba(99, 102, 241, 0.4)',
        'glow-speaking': '0 0 0 3px rgba(99, 102, 241, 0.7), 0 0 16px rgba(99, 102, 241, 0.5)',
      },
      fontFamily: {
        title: ['Poppins', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
