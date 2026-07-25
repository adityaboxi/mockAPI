/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1e1e2e',
        surface2: '#181825',
        surface3: '#313244',
        border: '#313244',
        text: '#cdd6f4',
        textMuted: '#6c7086',
        blue: '#89b4fa',
        green: '#a6da95',
        yellow: '#f9e2af',
        red: '#f38ba8',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};