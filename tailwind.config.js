/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper:    "#FFEAF3",
        paper2:   "#FFDCEC",
        surface:  "#FFFAFC",
        surface2: "#FFD9E9",
        ink:      "#5A2440",
        inkSoft:  "#A76487",
        inkFaint: "#D293B3",
        line:     "#FFC4DE",
        pain:     "#E5326E",
        painSoft: "#FFD2E3",
        comfort:  "#F98BA0",
        comfortSoft: "#FFE1E8",
        calm:     "#5FBFA0",
        lav:      "#D06BC4",
        lavSoft:  "#FBDAF5",
      },
      fontFamily: {
        round: ['"Zen Maru Gothic"', "ui-rounded", "sans-serif"],
        body:  ['"Zen Kaku Gothic New"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { blob: "28px" },
    },
  },
  plugins: [],
};
