package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Storage = []servicecatalog.CatalogItem{
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0004-000000000001"),
		Name:                 "minio",
		DisplayName:          "MinIO",
		Description:          "S3-compatible object storage",
		Category:             "Storage",
		DefaultImage:         "minio/minio:latest",
		DefaultContainerPort: 9000,
		DefaultCPU:           200,
		DefaultMemory:        512,
		HealthCheckType:      "http",
		HealthCheckPath:      "/minio/health/live",
		IsPublicImage:        true,
	},
}
