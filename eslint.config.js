import js from "@eslint/js";

const browserGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  CustomEvent: "readonly",
  DOMParser: "readonly",
  Event: "readonly",
  File: "readonly",
  FormData: "readonly",
  Headers: "readonly",
  Response: "readonly",
  Request: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  atob: "readonly",
  btoa: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  console: "readonly",
  crypto: "readonly",
  document: "readonly",
  fetch: "readonly",
  localStorage: "readonly",
  location: "readonly",
  navigator: "readonly",
  performance: "readonly",
  PerformanceObserver: "readonly",
  self: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  sessionStorage: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly",
  window: "readonly",
};

const nodeGlobals = {
  ...browserGlobals,
  process: "readonly",
  Buffer: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
};

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "dist/**",
      ".wrangler/**",
      "export/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["functions/**/*.js", "public/assets/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: browserGlobals,
    },
    rules: {
      "no-control-regex": "off",
      "no-empty": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    files: ["netlify/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: nodeGlobals,
    },
    rules: {
      "no-control-regex": "off",
      "no-empty": "off",
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
];

