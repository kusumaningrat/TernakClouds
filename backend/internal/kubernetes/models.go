package kubernetes

// ── Internal K8s API response types (for JSON parsing) ───────────────────────

type k8sList[T any] struct {
	Items []T `json:"items"`
}

type k8sObjectMeta struct {
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	CreationTimestamp string            `json:"creationTimestamp"`
	Labels            map[string]string `json:"labels"`
}

type k8sCondition struct {
	Type   string `json:"type"`
	Status string `json:"status"`
}

// Node
type k8sNodeItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Status   struct {
		Conditions []k8sCondition `json:"conditions"`
		NodeInfo   struct {
			KubeletVersion string `json:"kubeletVersion"`
		} `json:"nodeInfo"`
	} `json:"status"`
}

// Namespace
type k8sNamespaceItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Status   struct {
		Phase string `json:"phase"`
	} `json:"status"`
}

// Pod
type k8sPodItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Spec     struct {
		NodeName   string `json:"nodeName"`
		Containers []struct {
			Name string `json:"name"`
		} `json:"containers"`
	} `json:"spec"`
	Status struct {
		Phase            string `json:"phase"`
		ContainerStatuses []struct {
			Name         string `json:"name"`
			Ready        bool   `json:"ready"`
			RestartCount int    `json:"restartCount"`
		} `json:"containerStatuses"`
	} `json:"status"`
}

// Deployment
type k8sDeploymentItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Spec     struct {
		Replicas int32 `json:"replicas"`
	} `json:"spec"`
	Status struct {
		Replicas            int32 `json:"replicas"`
		ReadyReplicas       int32 `json:"readyReplicas"`
		UpdatedReplicas     int32 `json:"updatedReplicas"`
		AvailableReplicas   int32 `json:"availableReplicas"`
		UnavailableReplicas int32 `json:"unavailableReplicas"`
	} `json:"status"`
}

// Service (K8s Service resource)
type k8sServiceItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Spec     struct {
		Type      string      `json:"type"`
		ClusterIP string      `json:"clusterIP"`
		Ports     []k8sPort   `json:"ports"`
	} `json:"spec"`
}

type k8sPort struct {
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
	NodePort int32  `json:"nodePort"`
}

// ── Exported types returned to the frontend ───────────────────────────────────

type NodeStub struct {
	Name    string   `json:"name"`
	Status  string   `json:"status"`
	Roles   []string `json:"roles"`
	Version string   `json:"version"`
	Age     string   `json:"age"`
}

type NamespaceStub struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type PodStub struct {
	Name       string   `json:"name"`
	Namespace  string   `json:"namespace"`
	Phase      string   `json:"phase"`
	Ready      string   `json:"ready"`
	Restarts   int      `json:"restarts"`
	NodeName   string   `json:"nodeName"`
	Containers []string `json:"containers"`
	CreatedAt  string   `json:"createdAt"`
}

type DeploymentStub struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Desired     int32  `json:"desired"`
	Ready       int32  `json:"ready"`
	UpToDate    int32  `json:"upToDate"`
	Available   int32  `json:"available"`
	Unavailable int32  `json:"unavailable"`
	CreatedAt   string `json:"createdAt"`
}

type ServiceStub struct {
	Name      string      `json:"name"`
	Namespace string      `json:"namespace"`
	Type      string      `json:"type"`
	ClusterIP string      `json:"clusterIP"`
	Ports     []PortStub  `json:"ports"`
	CreatedAt string      `json:"createdAt"`
}

type PortStub struct {
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
	NodePort int32  `json:"nodePort,omitempty"`
}

// ── Internal structs for detail parsing ──────────────────────────────────────

// k8sDeploymentDetailItem parses the full single-deployment response
type k8sDeploymentDetailItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Spec     struct {
		Replicas int32 `json:"replicas"`
		Selector struct {
			MatchLabels map[string]string `json:"matchLabels"`
		} `json:"selector"`
		Template struct {
			Spec struct {
				Containers []k8sContainerSpec `json:"containers"`
			} `json:"spec"`
		} `json:"template"`
	} `json:"spec"`
	Status struct {
		Replicas            int32                `json:"replicas"`
		ReadyReplicas       int32                `json:"readyReplicas"`
		UpdatedReplicas     int32                `json:"updatedReplicas"`
		AvailableReplicas   int32                `json:"availableReplicas"`
		UnavailableReplicas int32                `json:"unavailableReplicas"`
		Conditions          []k8sDetailCondition `json:"conditions"`
	} `json:"status"`
}

type k8sContainerSpec struct {
	Name  string `json:"name"`
	Image string `json:"image"`
	Ports []struct {
		Name          string `json:"name"`
		ContainerPort int32  `json:"containerPort"`
		Protocol      string `json:"protocol"`
	} `json:"ports"`
}

type k8sDetailCondition struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
	Message string `json:"message"`
}

// k8sPodDetailItem parses the full single-pod response
type k8sPodDetailItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Spec     struct {
		NodeName   string             `json:"nodeName"`
		Containers []k8sContainerSpec `json:"containers"`
	} `json:"spec"`
	Status struct {
		Phase             string               `json:"phase"`
		Conditions        []k8sDetailCondition `json:"conditions"`
		ContainerStatuses []k8sContainerStatus `json:"containerStatuses"`
	} `json:"status"`
}

type k8sContainerStatus struct {
	Name         string `json:"name"`
	Image        string `json:"image"`
	Ready        bool   `json:"ready"`
	RestartCount int    `json:"restartCount"`
	State        struct {
		Running *struct {
			StartedAt string `json:"startedAt"`
		} `json:"running"`
		Waiting *struct {
			Reason  string `json:"reason"`
			Message string `json:"message"`
		} `json:"waiting"`
		Terminated *struct {
			ExitCode   int    `json:"exitCode"`
			Reason     string `json:"reason"`
			Message    string `json:"message"`
			FinishedAt string `json:"finishedAt"`
		} `json:"terminated"`
	} `json:"state"`
}

// k8sServiceDetailItem parses the full single-service response
type k8sServiceDetailItem struct {
	Metadata k8sObjectMeta `json:"metadata"`
	Spec     struct {
		Type        string            `json:"type"`
		ClusterIP   string            `json:"clusterIP"`
		ExternalIPs []string          `json:"externalIPs"`
		Selector    map[string]string `json:"selector"`
		Ports       []k8sPort         `json:"ports"`
	} `json:"spec"`
	Status struct {
		LoadBalancer struct {
			Ingress []struct {
				IP       string `json:"ip"`
				Hostname string `json:"hostname"`
			} `json:"ingress"`
		} `json:"loadBalancer"`
	} `json:"status"`
}

// k8sEndpoints parses the Endpoints resource
type k8sEndpoints struct {
	Subsets []struct {
		Addresses []struct {
			IP string `json:"ip"`
		} `json:"addresses"`
	} `json:"subsets"`
}

// ── Exported detail types ─────────────────────────────────────────────────────

// DeploymentDetail is returned by GET /kubernetes/deployments/:namespace/:name
type DeploymentDetail struct {
	Name        string              `json:"name"`
	Namespace   string              `json:"namespace"`
	Desired     int32               `json:"desired"`
	Ready       int32               `json:"ready"`
	UpToDate    int32               `json:"upToDate"`
	Available   int32               `json:"available"`
	Unavailable int32               `json:"unavailable"`
	Labels      map[string]string   `json:"labels"`
	Selector    map[string]string   `json:"selector"`
	Containers  []ContainerSpec     `json:"containers"`
	Conditions  []ResourceCondition `json:"conditions"`
	CreatedAt   string              `json:"createdAt"`
}

type ContainerSpec struct {
	Name  string          `json:"name"`
	Image string          `json:"image"`
	Ports []ContainerPort `json:"ports"`
}

type ContainerPort struct {
	Name          string `json:"name,omitempty"`
	ContainerPort int32  `json:"containerPort"`
	Protocol      string `json:"protocol"`
}

type ResourceCondition struct {
	Type    string `json:"type"`
	Status  string `json:"status"`
	Reason  string `json:"reason,omitempty"`
	Message string `json:"message,omitempty"`
}

// PodDetail is returned by GET /kubernetes/pods/:namespace/:name
type PodDetail struct {
	Name       string              `json:"name"`
	Namespace  string              `json:"namespace"`
	Phase      string              `json:"phase"`
	NodeName   string              `json:"nodeName"`
	Labels     map[string]string   `json:"labels"`
	Containers []ContainerDetail   `json:"containers"`
	Conditions []ResourceCondition `json:"conditions"`
	CreatedAt  string              `json:"createdAt"`
}

type ContainerDetail struct {
	Name         string         `json:"name"`
	Image        string         `json:"image"`
	Ready        bool           `json:"ready"`
	RestartCount int            `json:"restartCount"`
	State        ContainerState `json:"state"`
}

type ContainerState struct {
	Running    *ContainerStateRunning    `json:"running,omitempty"`
	Waiting    *ContainerStateWaiting    `json:"waiting,omitempty"`
	Terminated *ContainerStateTerminated `json:"terminated,omitempty"`
}

type ContainerStateRunning struct {
	StartedAt string `json:"startedAt"`
}

type ContainerStateWaiting struct {
	Reason  string `json:"reason"`
	Message string `json:"message,omitempty"`
}

type ContainerStateTerminated struct {
	ExitCode   int    `json:"exitCode"`
	Reason     string `json:"reason,omitempty"`
	Message    string `json:"message,omitempty"`
	FinishedAt string `json:"finishedAt,omitempty"`
}

// ServiceDetail is returned by GET /kubernetes/services/:namespace/:name
type ServiceDetail struct {
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	Type            string            `json:"type"`
	ClusterIP       string            `json:"clusterIP"`
	ExternalIPs     []string          `json:"externalIPs"`
	LoadBalancerIPs []string          `json:"loadBalancerIPs"`
	Selector        map[string]string `json:"selector"`
	Ports           []PortStub        `json:"ports"`
	Endpoints       []string          `json:"endpoints"`
	CreatedAt       string            `json:"createdAt"`
}

// ScaleInput is the request body for PATCH .../deployments/:namespace/:name/scale
type ScaleInput struct {
	Replicas *int `json:"replicas" binding:"required"`
}
