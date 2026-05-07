import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#060302',
        bg2: '#0d0a07',
        fg: '#EFE4CF',
        'fg-muted': '#906e50',
        'fg-dim': '#4a3322',
        soft: '#1e1208',
        gold: '#D4A76A',
        accent: '#D78A50',
        danger: '#e05555',
        success: '#4CAF50',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
