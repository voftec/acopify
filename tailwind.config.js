/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./public/**/*.html",
    "./public/assets/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        "primary-container": "#2563eb",
        "tertiary-fixed-dim": "#ffb4ab",
        "primary-fixed": "#dbe1ff",
        "surface-container-lowest": "#ffffff",
        "background": "#f8f9ff",
        "outline-variant": "#c3c6d7",
        "surface-container-highest": "#d5e3fc",
        "on-primary-fixed-variant": "#003ea8",
        "on-primary": "#ffffff",
        "surface-bright": "#f8f9ff",
        "surface-variant": "#d5e3fc",
        "surface-container-high": "#dce9ff",
        "on-tertiary-fixed": "#410002",
        "on-tertiary-container": "#ffecea",
        "on-secondary": "#ffffff",
        "surface": "#f8f9ff",
        "on-error": "#ffffff",
        "error": "#ba1a1a",
        "tertiary-container": "#d52022",
        "inverse-primary": "#b4c5ff",
        "on-primary-container": "#eeefff",
        "on-background": "#0d1c2e",
        "on-tertiary-fixed-variant": "#93000b",
        "on-secondary-container": "#5c2400",
        "surface-tint": "#0053db",
        "secondary-fixed": "#ffdbca",
        "inverse-on-surface": "#eaf1ff",
        "tertiary": "#ae0010",
        "secondary-container": "#fd761a",
        "on-secondary-fixed": "#341100",
        "secondary-fixed-dim": "#ffb690",
        "on-tertiary": "#ffffff",
        "outline": "#737686",
        "primary": "#004ac6",
        "surface-container": "#e6eeff",
        "primary-fixed-dim": "#b4c5ff",
        "surface-container-low": "#eff4ff",
        "tertiary-fixed": "#ffdad6",
        "on-secondary-fixed-variant": "#783200",
        "on-surface-variant": "#434655",
        "on-surface": "#0d1c2e",
        "on-error-container": "#93000a",
        "error-container": "#ffdad6",
        "secondary": "#9d4300",
        "on-primary-fixed": "#00174b",
        "surface-dim": "#ccdbf3",
        "inverse-surface": "#233144"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "xs": "4px",
        "lg": "24px",
        "xl": "32px",
        "unit": "4px",
        "gutter": "16px",
        "sm": "8px",
        "container-margin-desktop": "40px",
        "container-margin-mobile": "16px",
        "md": "16px"
      },
      fontFamily: {
        "body-lg": ["Inter"],
        "display-lg": ["Inter"],
        "body-md": ["Inter"],
        "status-sm": ["Inter"],
        "headline-lg-mobile": ["Inter"],
        "headline-lg": ["Inter"],
        "label-md": ["Inter"],
        "headline-md": ["Inter"]
      },
      fontSize: {
        "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "800" }],
        "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
        "status-sm": ["12px", { "lineHeight": "16px", "fontWeight": "700" }],
        "headline-lg-mobile": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
        "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "label-md": ["14px", { "lineHeight": "20px", "letterSpacing": "0.05em", "fontWeight": "600" }],
        "headline-md": ["24px", { "lineHeight": "32px", "fontWeight": "600" }]
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ]
};
