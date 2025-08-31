/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cloak: {
          900: "#0f1720", // خلفية غامقة جداً
          800: "#172230",
          700: "#1f2e40",
          600: "#2a3b50",
        },
        gold: {
          300: "#ffe08a",
          400: "#facc15",
          500: "#F4C430",
        },
      },
    },
  },
  plugins: [],
};
