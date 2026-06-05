package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Networking = []servicecatalog.CatalogItem{
	{
		ID:              uuid.MustParse("00000010-0000-0000-0006-000000000001"),
		Name:            "nginx",
		DisplayName:     "Nginx",
		Description:     "High-performance web server and reverse proxy",
		Category:        "Networking",
		DefaultPorts:    ports(servicecatalog.PortDef{Name: "http", ContainerPort: 80, Protocol: "tcp", Primary: true}),
		DefaultImage:    "nginx:alpine",
		DefaultCPU:      100,
		DefaultMemory:   128,
		HealthCheckType: "http",
		HealthCheckPath: "/",
		IsPublicImage:   true,
	},
	{
		ID:          uuid.MustParse("00000010-0000-0000-0006-000000000002"),
		Name:        "traefik",
		DisplayName: "Traefik",
		Description: "Cloud-native application proxy and load balancer",
		Category:    "Networking",
		DefaultPorts: ports(
			servicecatalog.PortDef{Name: "http", ContainerPort: 80, Protocol: "tcp", Primary: true},
			servicecatalog.PortDef{Name: "dashboard", ContainerPort: 8080, Protocol: "tcp"},
		),
		DefaultImage:    "traefik:v3",
		DefaultCPU:      100,
		DefaultMemory:   128,
		HealthCheckType: "http",
		HealthCheckPath: "/ping",
		IsPublicImage:   true,
	},
}
