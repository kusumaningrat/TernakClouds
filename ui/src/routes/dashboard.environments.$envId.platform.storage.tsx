import { createFileRoute, useParams } from "@tanstack/react-router";
import { CapabilityPage } from "@/components/CapabilityPage";

export const Route = createFileRoute("/dashboard/environments/$envId/platform/storage")({
  head: () => ({ meta: [{ title: "Storage · TernakClouds" }] }),
  component: StorageCapabilityPage,
});

function StorageCapabilityPage() {
  const { envId } = useParams({ from: "/dashboard/environments/$envId/platform/storage" });
  return (
    <CapabilityPage
      envId={envId}
      capName="storage"
      title="Storage"
      subtitle="Object storage for artifacts, backups, and application data — MinIO, AWS S3, GCS, Azure Blob, Cloudflare R2."
      endpointPlaceholders={{
        minio: "https://minio.internal:9000",
        s3: "https://s3.amazonaws.com",
        gcs: "https://storage.googleapis.com",
        "azure-blob": "https://accountname.blob.core.windows.net",
        r2: "https://<accountID>.r2.cloudflarestorage.com",
        b2: "https://s3.us-west-004.backblazeb2.com",
      }}
      tokenPlaceholders={{
        minio: "accessKeyID:secretAccessKey",
        s3: "AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        gcs: "hmacKeyID:hmacKeySecret",
        "azure-blob": "accountname:base64AccountKey==",
        r2: "accessKeyID:secretAccessKey",
        b2: "keyID:applicationKey",
      }}
    />
  );
}
