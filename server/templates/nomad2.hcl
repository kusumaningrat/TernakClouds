job "{{ job_name }}-App" {
  datacenters = ["{{ datacenter_name }}"]
  type        = "service"
  namespace   = "{{ namespace }}"

  update {
    max_parallel     = 1
    health_check     = "task_states"
    min_healthy_time = "30s"
  }

  group "{{ job_name }}" {
    count = 1

    network {
      port "http" {
        static       = { { exposed_port } }
        to           = { { container_port } }
        host_network = "private"
      }
    }

    service {
      name = "{{ job_name }}"
      tags = ["apps", "logs.promtail"]
      port = "http"
      check {
        name     = "api-health"
        type     = "http"
        port     = "{{ exposed_port }}"
        interval = "30s"
        timeout  = "10s"
      }
    }

    constraint {
      attribute = "${attr.unique.hostname}"
      value     = "{{ worker_name }}"
    }

    task "{{ job_name }}" {
      driver = "docker"

      config {
        image       = "{{registered_registry}}/{{ registry_name }}/{{ job_name }}:IMAGE_TAG_PLACEHOLDER"
        ports       = ["http"]
        dns_servers = ["172.17.0.1", "172.18.0.1", "8.8.8.8", "8.8.4.4", "1.1.1.1"] // Optional
      }

      resources {
        cpu    = { { cpu } }
        memory = { { memory } }
      }
    }
  }
}
