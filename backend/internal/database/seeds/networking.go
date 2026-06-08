package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Networking = []servicecatalog.CatalogItem{
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0006-000000000001"),
		Name:                 "nginx",
		DisplayName:          "Nginx",
		Description:          "High-performance web server and reverse proxy",
		Category:             "Networking",
		DefaultImage:         "nginx:alpine",
		DefaultContainerPort: 80,
		DefaultCPU:           100,
		DefaultMemory:        128,
		HealthCheckType:      "http",
		HealthCheckPath:      "/",
		IsPublicImage:        true,
	},
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0006-000000000002"),
		Name:                 "traefik",
		DisplayName:          "Traefik",
		Description:          "Cloud-native application proxy and load balancer",
		Category:             "Networking",
		DefaultImage:         "traefik:v3",
		DefaultContainerPort: 80,
		DefaultCPU:           100,
		DefaultMemory:        128,
		HealthCheckType:      "http",
		HealthCheckPath:      "/ping",
		IsPublicImage:        true,
	},
}
