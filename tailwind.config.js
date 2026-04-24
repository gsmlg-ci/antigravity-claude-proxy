import forms from '@tailwindcss/forms';
import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './public/**/*.{html,js}',
    './src/**/*.{js,mjs}'
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          purple: '#a855f7',
          green: '#22c55e',
          cyan: '#06b6d4',
          yellow: '#eab308',
          red: '#ef4444'
        },
        space: {
          950: '#09090b',
          900: '#0f0f11',
          850: '#121214',
          800: '#18181b',
          border: '#27272a'
        }
      }
    }
  },
  plugins: [forms, daisyui],
  daisyui: {
    themes: ['black']
  }
};
