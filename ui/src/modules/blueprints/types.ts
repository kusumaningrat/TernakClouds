export interface Blueprint {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: "application" | "infrastructure" | "cicd";
  version: string;
  supported_runtimes: string[];
  is_public: boolean;
  is_system: boolean;
  icon?: string;
  created_at: string;
  default_image?: string;
  default_tag?: string;
  default_port?: number;
  default_cpu?: number;
  default_memory_mb?: number;
  cicd_provider?: string;
}
