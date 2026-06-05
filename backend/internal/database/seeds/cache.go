package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Cache = []servicecatalog.CatalogItem{
	{
		ID:              uuid.MustParse("00000010-0000-0000-0003-000000000001"),
		Name:            "redis",
		DisplayName:     "Redis",
		Description:     "In-memory data structure store (cache, message broker)",
		Category:        "Cache",
		DefaultPorts:    ports(servicecatalog.PortDef{Name: "redis", ContainerPort: 6379, Protocol: "tcp", Primary: true}),
		DefaultImage:    "redis:7-alpine",
		DefaultCPU:      100,
		DefaultMemory:   100,
		HealthCheckType: "tcp",
		IsPublicImage:   true,
	},
}
