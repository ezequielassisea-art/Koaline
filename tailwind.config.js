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
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        'primary-hover': 'rgb(var(--primary-hover-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        error: 'rgb(var(--error-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-hover': 'rgb(var(--surface-hover-rgb) / <alpha-value>)',
        overlay: 'rgb(var(--overlay-rgb) / <alpha-value>)',
        'text-main': 'rgb(var(--text-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        'text-inverse': 'rgb(var(--text-inverse-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        accent: 'rgb(var(--primary-rgb) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-sunken': 'rgb(var(--bg-rgb) / <alpha-value>)',
      },
      borderRadius: {
        'nest': 'var(--radius-nest, 16px)',
        'nest-sm': 'var(--radius-nest-sm, 10px)',
        'nest-lg': 'var(--radius-nest-lg, 24px)',
        'nest-pill': '9999px',
      },
      boxShadow: {
        'nest': '0 4px 20px -2px rgb(var(--overlay-rgb) / 0.25)',
        'nest-elevated': '0 20px 45px -8px rgb(var(--overlay-rgb) / 0.45)',
        'glow-primary': '0 0 25px -4px rgb(var(--primary-rgb) / 0.4)',
        'glow-speaking': '0 0 0 3px rgb(var(--primary-rgb) / 0.7), 0 0 16px rgb(var(--primary-rgb) / 0.5)',
      },
      fontFamily: {
        title: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'h1': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2': ['24px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3': ['20px', { lineHeight: '1.5', fontWeight: '600' }],
        'base': ['16px', { lineHeight: '1.5' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'xs': ['12px', { lineHeight: '1.5' }],
      }
    },
  },
  plugins: [],
}
