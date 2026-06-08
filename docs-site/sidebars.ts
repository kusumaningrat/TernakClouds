import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: ["introduction/overview", "getting-started/installation"],
    },
    {
      type: "category",
      label: "Platform",
      collapsed: false,
      items: ["architecture/overview", "authentication/rbac"],
    },
    {
      type: "category",
      label: "Runtimes & Observability",
      collapsed: false,
      items: ["runtimes/overview", "logs/overview"],
    },
    {
      type: "category",
      label: "Deployments",
      collapsed: false,
      items: [
        "deployments/service-catalog",
        "deployments/blueprints",
        "deployments/platform-apps",
      ],
    },
    {
      type: "category",
      label: "Integrations",
      collapsed: false,
      items: [
        "secrets/overview",
        "registry/overview",
        "repositories/overview",
      ],
    },
    {
      type: "category",
      label: "Contributing",
      collapsed: false,
      items: ["contributing/guide"],
    },
  ],
};

export default sidebars;
