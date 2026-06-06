export interface Blueprint {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: 'application' | 'infrastructure';
  version: string;
  supported_runtimes: string[];
  is_public: boolean;
  is_system: boolean;
  icon?: string;
  created_at: string;
}
