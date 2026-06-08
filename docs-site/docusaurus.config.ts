import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "TernakClouds",
  tagline: "Internal Developer Platform",
  favicon: "img/favicon.svg",

  url: "https://ternak.clouds",
  baseUrl: "/",

  onBrokenLinks: "throw",
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  themes: ["@docusaurus/theme-mermaid"],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "/docs",
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/kusumaningrat/TernakClouds/edit/main/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/social-card.png",
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "TernakClouds",
      logo: {
        alt: "TernakClouds",
        src: "img/logo.svg",
        srcDark: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://github.com/kusumaningrat/TernakClouds",
          position: "right",
          className: "header-github-link",
          "aria-label": "GitHub repository",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Getting Started",
          items: [
            { label: "Introduction", to: "/docs/introduction/overview" },
            { label: "Installation", to: "/docs/getting-started/installation" },
            { label: "Architecture", to: "/docs/architecture/overview" },
          ],
        },
        {
          title: "Platform",
          items: [
            { label: "Runtimes", to: "/docs/runtimes/overview" },
            { label: "Deployments", to: "/docs/deployments/service-catalog" },
            { label: "Secrets", to: "/docs/secrets/overview" },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/kusumaningrat/TernakClouds",
            },
            { label: "Contributing", to: "/docs/contributing/guide" },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} TernakClouds · Platform Engineering`,
    },
    prism: {
      theme: prismThemes.oneDark,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ["bash", "yaml", "json", "go", "typescript", "hcl"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
