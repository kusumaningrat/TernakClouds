export interface Bucket {
  name: string;
  created_at: string;
  region?: string;
}

export interface StorageProviderInfo {
  provider_name: string;
  display_name: string;
  endpoint: string;
  region?: string;
}
