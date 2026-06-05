package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Storage = []servicecatalog.CatalogItem{
	{
		ID:          uuid.MustParse("00000010-0000-0000-0004-000000000001"),
		Name:        "minio",
		DisplayName: "MinIO",
		Description: "S3-compatible object storage",
		Category:    "Storage",
		DefaultPorts: ports(
			servicecatalog.PortDef{Name: "api", ContainerPort: 9000, Protocol: "tcp", Primary: true},
			servicecatalog.PortDef{Name: "console", ContainerPort: 9001, Protocol: "tcp"},
		),
		DefaultImage:    "minio/minio:latest",
		DefaultCPU:      100,
		DefaultMemory:   128,
		HealthCheckType: "http",
		HealthCheckPath: "/minio/health/live",
		IsPublicImage:   true,
	},
}
