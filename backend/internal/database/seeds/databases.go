package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Databases = []servicecatalog.CatalogItem{
	{
		ID:              uuid.MustParse("00000010-0000-0000-0002-000000000001"),
		Name:            "postgres",
		DisplayName:     "PostgreSQL",
		Description:     "Open source relational database",
		Category:        "Database",
		DefaultPorts:    ports(servicecatalog.PortDef{Name: "pg", ContainerPort: 5432, Protocol: "tcp", Primary: true}),
		DefaultImage:    "postgres:16-alpine",
		DefaultCPU:      200,
		DefaultMemory:   200,
		HealthCheckType: "tcp",
		IsPublicImage:   true,
	},
	{
		ID:              uuid.MustParse("00000010-0000-0000-0002-000000000002"),
		Name:            "mysql",
		DisplayName:     "MySQL",
		Description:     "Widely used open-source relational database",
		Category:        "Database",
		DefaultPorts:    ports(servicecatalog.PortDef{Name: "mysql", ContainerPort: 3306, Protocol: "tcp", Primary: true}),
		DefaultImage:    "mysql:8-debian",
		DefaultCPU:      200,
		DefaultMemory:   200,
		HealthCheckType: "tcp",
		IsPublicImage:   true,
	},
	{
		ID:              uuid.MustParse("00000010-0000-0000-0002-000000000003"),
		Name:            "mongodb",
		DisplayName:     "MongoDB",
		Description:     "Open source NoSQL document database",
		Category:        "Database",
		DefaultPorts:    ports(servicecatalog.PortDef{Name: "mongo", ContainerPort: 27017, Protocol: "tcp", Primary: true}),
		DefaultImage:    "mongodb/mongodb-community-server:7-ubi8",
		DefaultCPU:      200,
		DefaultMemory:   200,
		HealthCheckType: "tcp",
		IsPublicImage:   true,
	},
}
