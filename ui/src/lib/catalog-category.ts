import type { CatalogItem } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { Database, Zap, Radio, HardDrive, Activity, Network, Cpu, Box } from "lucide-react";

export const ALL_CATEGORIES = [
  "All",
  "Database",
  "Cache",
  "Message Broker",
  "Object Storage",
  "Monitoring",
  "Networking",
  "AI Services",
  "Application",
] as const;

export type Category = (typeof ALL_CATEGORIES)[number];

const CATEGORY_PATTERNS: [RegExp, Exclude<Category, "All">][] = [
  [/postgres|mysql|mariadb|mongodb|mongo|cassandra|cockroach|clickhouse|tidb/i, "Database"],
  [/redis|memcached|dragonfly|keydb/i, "Cache"],
  [/rabbit|kafka|nats|pulsar|activemq/i, "Message Broker"],
  [/minio|seaweed|ceph|swift/i, "Object Storage"],
  [/prometheus|grafana|loki|jaeger|tempo|alertmanager|zipkin/i, "Monitoring"],
  [/nginx|traefik|haproxy|envoy|kong|caddy/i, "Networking"],
  [/ollama|llm|whisper|ai-/i, "AI Services"],
];

export function inferCategory(item: CatalogItem): Exclude<Category, "All"> {
  const text = `${item.name} ${item.display_name}`;
  for (const [pattern, cat] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return cat;
  }
  return "Application";
}

export type CategoryConfig = { icon: LucideIcon; color: string; bg: string };

export const CATEGORY_CONFIG: Record<Exclude<Category, "All">, CategoryConfig> = {
  Database: { icon: Database, color: "text-blue-600", bg: "bg-blue-500/10" },
  Cache: { icon: Zap, color: "text-amber-600", bg: "bg-amber-500/10" },
  "Message Broker": { icon: Radio, color: "text-purple-600", bg: "bg-purple-500/10" },
  "Object Storage": { icon: HardDrive, color: "text-teal-600", bg: "bg-teal-500/10" },
  Monitoring: { icon: Activity, color: "text-orange-600", bg: "bg-orange-500/10" },
  Networking: { icon: Network, color: "text-slate-600", bg: "bg-slate-500/10" },
  "AI Services": { icon: Cpu, color: "text-violet-600", bg: "bg-violet-500/10" },
  Application: { icon: Box, color: "text-primary", bg: "bg-primary/10" },
};
