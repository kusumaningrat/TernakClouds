package seeds

import (
	"github.com/google/uuid"
	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
)

var Messaging = []servicecatalog.CatalogItem{
	{
		ID:          uuid.MustParse("00000010-0000-0000-0005-000000000001"),
		Name:        "rabbitmq",
		DisplayName: "RabbitMQ",
		Description: "Open source message broker",
		Category:    "Messaging",
		DefaultPorts: ports(
			servicecatalog.PortDef{Name: "amqp", ContainerPort: 5672, Protocol: "tcp", Primary: true},
			servicecatalog.PortDef{Name: "mgmt", ContainerPort: 15672, Protocol: "tcp"},
		),
		DefaultImage:    "rabbitmq:3-management-alpine",
		DefaultCPU:      200,
		DefaultMemory:   256,
		HealthCheckType: "http",
		HealthCheckPath: "/",
		IsPublicImage:   true,
	},
	{
		ID:          uuid.MustParse("00000010-0000-0000-0005-000000000002"),
		Name:        "kafka",
		DisplayName: "Kafka",
		Description: "Distributed event streaming platform",
		Category:    "Messaging",
		DefaultPorts: ports(
			servicecatalog.PortDef{Name: "broker", ContainerPort: 9092, Protocol: "tcp", Primary: true},
		),
		DefaultImage:    "apache/kafka:3.7.0",
		DefaultCPU:      500,
		DefaultMemory:   512,
		HealthCheckType: "tcp",
		IsPublicImage:   true,
	},
}
