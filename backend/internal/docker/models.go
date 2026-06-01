package docker

// ── Internal Docker Engine API response types (for JSON parsing) ──────────────

type dockerContainerListItem struct {
	ID      string            `json:"Id"`
	Names   []string          `json:"Names"`
	Image   string            `json:"Image"`
	ImageID string            `json:"ImageID"`
	Created int64             `json:"Created"`
	State   string            `json:"State"`
	Status  string            `json:"Status"`
	Ports   []dockerPort      `json:"Ports"`
	Labels  map[string]string `json:"Labels"`
}

type dockerPort struct {
	IP          string `json:"IP"`
	PrivatePort uint16 `json:"PrivatePort"`
	PublicPort  uint16 `json:"PublicPort"`
	Type        string `json:"Type"`
}

type dockerContainerInspect struct {
	ID      string `json:"Id"`
	Name    string `json:"Name"`
	Created string `json:"Created"`
	Image   string `json:"Image"`
	State   struct {
		Status     string `json:"Status"`
		Running    bool   `json:"Running"`
		Paused     bool   `json:"Paused"`
		Restarting bool   `json:"Restarting"`
		ExitCode   int    `json:"ExitCode"`
		StartedAt  string `json:"StartedAt"`
		FinishedAt string `json:"FinishedAt"`
		Error      string `json:"Error"`
	} `json:"State"`
	Config struct {
		Image  string            `json:"Image"`
		Cmd    []string          `json:"Cmd"`
		Env    []string          `json:"Env"`
		Labels map[string]string `json:"Labels"`
	} `json:"Config"`
	HostConfig struct {
		PortBindings map[string][]struct {
			HostIP   string `json:"HostIp"`
			HostPort string `json:"HostPort"`
		} `json:"PortBindings"`
		RestartPolicy struct {
			Name string `json:"Name"`
		} `json:"RestartPolicy"`
	} `json:"HostConfig"`
	NetworkSettings struct {
		Networks map[string]struct {
			IPAddress string `json:"IPAddress"`
			Gateway   string `json:"Gateway"`
		} `json:"Networks"`
	} `json:"NetworkSettings"`
	Mounts []struct {
		Type        string `json:"Type"`
		Source      string `json:"Source"`
		Destination string `json:"Destination"`
		Mode        string `json:"Mode"`
	} `json:"Mounts"`
}

type dockerImageListItem struct {
	ID       string   `json:"Id"`
	RepoTags []string `json:"RepoTags"`
	Size     int64    `json:"Size"`
	Created  int64    `json:"Created"`
}

type dockerNetworkListItem struct {
	ID     string `json:"Id"`
	Name   string `json:"Name"`
	Driver string `json:"Driver"`
	Scope  string `json:"Scope"`
	IPAM   struct {
		Config []struct {
			Subnet string `json:"Subnet"`
		} `json:"Config"`
	} `json:"IPAM"`
}

type dockerVolumeListResponse struct {
	Volumes []struct {
		Name       string `json:"Name"`
		Driver     string `json:"Driver"`
		Mountpoint string `json:"Mountpoint"`
		Scope      string `json:"Scope"`
	} `json:"Volumes"`
}

// ── Exported types returned to the frontend ───────────────────────────────────

type PortBinding struct {
	IP          string `json:"ip,omitempty"`
	PrivatePort uint16 `json:"private_port"`
	PublicPort  uint16 `json:"public_port,omitempty"`
	Type        string `json:"type"`
}

// ContainerStub is the list view of a Docker container.
type ContainerStub struct {
	ID      string            `json:"id"`
	Name    string            `json:"name"`
	Image   string            `json:"image"`
	State   string            `json:"state"`
	Status  string            `json:"status"`
	Created int64             `json:"created"`
	Ports   []PortBinding     `json:"ports"`
	Labels  map[string]string `json:"labels"`
}

// ContainerDetail is the full inspect view of a Docker container.
type ContainerDetail struct {
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	Image         string             `json:"image"`
	ImageID       string             `json:"image_id"`
	Created       string             `json:"created"`
	State         ContainerState     `json:"state"`
	Config        ContainerConfig    `json:"config"`
	Networks      []ContainerNetwork `json:"networks"`
	Ports         []BoundPort        `json:"ports"`
	Mounts        []ContainerMount   `json:"mounts"`
	RestartPolicy string             `json:"restart_policy"`
}

type ContainerState struct {
	Status     string `json:"status"`
	Running    bool   `json:"running"`
	Paused     bool   `json:"paused"`
	Restarting bool   `json:"restarting"`
	ExitCode   int    `json:"exit_code"`
	StartedAt  string `json:"started_at"`
	FinishedAt string `json:"finished_at"`
	Error      string `json:"error,omitempty"`
}

type ContainerConfig struct {
	Image  string            `json:"image"`
	Cmd    []string          `json:"cmd,omitempty"`
	Env    []string          `json:"env,omitempty"`
	Labels map[string]string `json:"labels,omitempty"`
}

type ContainerNetwork struct {
	Name      string `json:"name"`
	IPAddress string `json:"ip_address"`
	Gateway   string `json:"gateway"`
}

type BoundPort struct {
	PrivatePort string `json:"private_port"`
	HostIP      string `json:"host_ip,omitempty"`
	HostPort    string `json:"host_port,omitempty"`
}

type ContainerMount struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode"`
}

// ImageStub is the list view of a Docker image.
type ImageStub struct {
	ID      string   `json:"id"`
	Tags    []string `json:"tags"`
	Size    int64    `json:"size"`
	Created int64    `json:"created"`
}

// NetworkStub is the list view of a Docker network.
type NetworkStub struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Driver string `json:"driver"`
	Scope  string `json:"scope"`
	Subnet string `json:"subnet,omitempty"`
}

// VolumeStub is the list view of a Docker volume.
type VolumeStub struct {
	Name       string `json:"name"`
	Driver     string `json:"driver"`
	Mountpoint string `json:"mountpoint"`
	Scope      string `json:"scope"`
}
