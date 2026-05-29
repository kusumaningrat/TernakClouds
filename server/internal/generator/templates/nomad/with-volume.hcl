job "[[.JobID]]" {
  datacenters = ["[[.Datacenter]]"]
  type        = "[[.JobType]]"
  namespace   = "[[.Namespace]]"

  update {
    max_parallel     = 1
    health_check     = "task_states"
    min_healthy_time = "30s"
    healthy_deadline = "5m"
    auto_revert      = true
    [[- if eq .Strategy "canary"]]
    canary           = 1
    [[- end]]
  }

  group "[[.ServiceName]]" {
    count = 1

    volume "[[.VolumeName]]" {
      type      = "host"
      read_only = false
      source    = "[[.VolumeName]]"
    }

    network {
      port "[[.PortLabel]]" {
        static       = [[.ExposedPort]]
        to           = [[.ContainerPort]]
        host_network = "private"
      }
    }

    service {
      name     = "[[.ServiceName]]"
      tags     = ["apps", "logs.promtail", "blueprints", "[[.BlueprintType]]"[[if .WorkspaceLabel]], "workspace:[[.WorkspaceLabel]]"[[end]]]
      port     = "[[.PortLabel]]"
      [[- if ne .BlueprintType "worker"]]
      check {
        name     = "health"
        type     = "http"
        port     = "[[.PortLabel]]"
        path     = "[[.HealthPath]]"
        interval = "30s"
        timeout  = "10s"
      }
      [[- end]]
    }

    constraint {
      attribute = "${attr.unique.hostname}"
      value     = "[[.WorkerName]]"
    }

    task "[[.ServiceName]]" {
      driver = "docker"

      config {
        image = "[[.Image]]"
        ports = ["[[.PortLabel]]"]
        [[- if .RegistryUsername]]
        [[- end]]
        dns_servers = ["172.17.0.1", "172.18.0.1", "8.8.8.8", "1.1.1.1"]
        labels {
          blueprint     = "[[.BlueprintType]]"
          service       = "[[.ServiceName]]"
          [[- if .WorkspaceLabel]]
          workspace     = "[[.WorkspaceLabel]]"
          [[- end]]
          [[- if .EnvironmentLabel]]
          environment   = "[[.EnvironmentLabel]]"
          [[- end]]
        }
      }

      volume_mount {
        volume      = "[[.VolumeName]]"
        destination = "[[.VolumeMountPath]]"
        read_only   = false
      }
      [[- if .VaultRole]]

      vault {
        role = "[[.VaultRole]]"
      }
      [[- end]]
      [[- if .VaultPath]]

      template {
        destination = "secrets/env"
        env         = true
        data        = <<EOF
{{ with secret "[[.VaultPath]]" }}{{ range $k, $v := .Data.data }}{{ $k }}="{{ $v }}"
{{ end }}{{ end }}
EOF
      }
      [[- end]]

      resources {
        cpu    = [[.CPU]]
        memory = [[.MemoryMB]]
      }

      logs {
        max_files     = 5
        max_file_size = 15
      }
    }
  }
}
