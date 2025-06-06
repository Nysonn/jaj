/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FA5D0F",
        secondary: "#FFBC36"
      },
      fontFamily: {
        sans: ["Roboto", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};
