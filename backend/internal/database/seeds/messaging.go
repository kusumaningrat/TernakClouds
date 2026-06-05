package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Messaging = []servicecatalog.CatalogItem{
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0005-000000000001"),
		Name:                 "rabbitmq",
		DisplayName:          "RabbitMQ",
		Description:          "Open source message broker",
		Category:             "Messaging",
		DefaultImage:         "rabbitmq:3-management-alpine",
		DefaultContainerPort: 5672,
		DefaultCPU:           200,
		DefaultMemory:        256,
		HealthCheckType:      "tcp",
		IsPublicImage:        true,
	},
	{
		ID:                   uuid.MustParse("00000010-0000-0000-0005-000000000002"),
		Name:                 "kafka",
		DisplayName:          "Kafka",
		Description:          "Distributed event streaming platform",
		Category:             "Messaging",
		DefaultImage:         "apache/kafka:3.7.0",
		DefaultContainerPort: 9092,
		DefaultCPU:           500,
		DefaultMemory:        512,
		HealthCheckType:      "tcp",
		IsPublicImage:        true,
	},
}
