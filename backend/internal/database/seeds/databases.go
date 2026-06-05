package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Databases = []servicecatalog.CatalogItem{
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0002-000000000001"),
		Name:                 "postgres",
		DisplayName:          "PostgreSQL",
		Description:          "Open source relational database",
		Category:             "Database",
		DefaultImage:         "postgres:16-alpine",
		DefaultContainerPort: 5432,
		DefaultCPU:           200,
		DefaultMemory:        200,
		HealthCheckType:      "tcp",
		IsPublicImage:        true,
	},
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0002-000000000002"),
		Name:                 "mysql",
		DisplayName:          "MySQL",
		Description:          "Widely used open-source relational database",
		Category:             "Database",
		DefaultImage:         "mysql:8-debian",
		DefaultContainerPort: 3306,
		DefaultCPU:           200,
		DefaultMemory:        200,
		HealthCheckType:      "tcp",
		IsPublicImage:        true,
	},
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0002-000000000003"),
		Name:                 "mongodb",
		DisplayName:          "MongoDB",
		Description:          "Open source NoSQL document database",
		Category:             "Database",
		DefaultImage:         "mongodb/mongodb-community-server:7-ubi8",
		DefaultContainerPort: 27017,
		DefaultCPU:           200,
		DefaultMemory:        200,
		HealthCheckType:      "tcp",
		IsPublicImage:        true,
	},
}
