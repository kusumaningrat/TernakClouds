import { Globe, Cpu, Clock, Network, LayoutDashboard, Zap, Layers } from "lucide-react";

export const ICONS: Record<string, React.ElementType> = {
  globe: Globe,
  cpu: Cpu,
  clock: Clock,
  network: Network,
  "layout-dashboard": LayoutDashboard,
  zap: Zap,
};

export const CATEGORY_COLORS: Record<string, string> = {
  application: "bg-blue-500/15 text-blue-600",
  infrastructure: "bg-amber-500/15 text-amber-600",
};

export function BlueprintIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Layers;
  return <Icon className={className ?? "size-5 text-muted-foreground"} />;
}
