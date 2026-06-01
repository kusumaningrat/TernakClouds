package nomad

// NodeStub is a summary of a Nomad node (worker/client agent).
// Corresponds to the items returned by GET /v1/nodes.
type NodeStub struct {
	ID                    string            `json:"ID"`
	Name                  string            `json:"Name"`
	Address               string            `json:"Address"`
	Datacenter            string            `json:"Datacenter"`
	NodeClass             string            `json:"NodeClass"`
	Version               string            `json:"Version"`
	Status                string            `json:"Status"`
	StatusDescription     string            `json:"StatusDescription"`
	Drain                 bool              `json:"Drain"`
	SchedulingEligibility string            `json:"SchedulingEligibility"`
	Drivers               map[string]DriverInfo `json:"Drivers"`
}

// DriverInfo describes a task driver detected on a node.
type DriverInfo struct {
	Detected bool `json:"Detected"`
	Healthy  bool `json:"Healthy"`
}

// Namespace corresponds to the items returned by GET /v1/namespaces.
type Namespace struct {
	Name        string `json:"Name"`
	Description string `json:"Description"`
}

// JobListStub is a summary of a Nomad job.
// Corresponds to the items returned by GET /v1/jobs.
type JobListStub struct {
	ID          string          `json:"ID"`
	ParentID    string          `json:"ParentID"`
	Name        string          `json:"Name"`
	Namespace   string          `json:"Namespace"`
	Type        string          `json:"Type"`
	Priority    int             `json:"Priority"`
	Status      string          `json:"Status"`
	StatusSummary JobStatusSummary `json:"JobSummary"`
	SubmitTime  int64           `json:"SubmitTime"`
	Datacenters []string        `json:"Datacenters"`
}

// JobStatusSummary groups task-group allocation counts for a job.
type JobStatusSummary struct {
	JobID     string                        `json:"JobID"`
	Namespace string                        `json:"Namespace"`
	Summary   map[string]TaskGroupSummary   `json:"Summary"`
}

// TaskGroupSummary holds allocation state counts for one task group.
type TaskGroupSummary struct {
	Queued   int `json:"Queued"`
	Complete int `json:"Complete"`
	Failed   int `json:"Failed"`
	Running  int `json:"Running"`
	Starting int `json:"Starting"`
	Lost     int `json:"Lost"`
	Unknown  int `json:"Unknown"`
}

// JobActionResponse is returned by stop and start operations.
type JobActionResponse struct {
	EvalID          string `json:"EvalID"`
	EvalCreateIndex uint64 `json:"EvalCreateIndex"`
	JobModifyIndex  uint64 `json:"JobModifyIndex"`
	Index           uint64 `json:"Index"`
}

// AllocationStub is a summary of one Nomad allocation.
// Corresponds to items returned by GET /v1/job/:jobID/allocations.
type AllocationStub struct {
	ID            string                `json:"ID"`
	EvalID        string                `json:"EvalID"`
	Name          string                `json:"Name"`
	Namespace     string                `json:"Namespace"`
	NodeID        string                `json:"NodeID"`
	NodeName      string                `json:"NodeName"`
	JobID         string                `json:"JobID"`
	TaskGroup     string                `json:"TaskGroup"`
	DesiredStatus string                `json:"DesiredStatus"`
	ClientStatus  string                `json:"ClientStatus"`
	TaskStates    map[string]TaskState  `json:"TaskStates"`
	CreateTime    int64                 `json:"CreateTime"`
	ModifyTime    int64                 `json:"ModifyTime"`
}

// TaskState is the runtime state of one task within an allocation.
type TaskState struct {
	State      string `json:"State"`
	Failed     bool   `json:"Failed"`
	Restarts   uint64 `json:"Restarts"`
	StartedAt  string `json:"StartedAt"`
	FinishedAt string `json:"FinishedAt"`
}

// LogFrame is a single frame in Nomad's streaming log response.
// Data is base64-encoded log content; empty Data frames are heartbeats.
type LogFrame struct {
	Data      string `json:"Data"`
	FileEvent string `json:"FileEvent"`
	Offset    int64  `json:"Offset"`
}

// EvalStub summarises a Nomad scheduler evaluation.
type EvalStub struct {
	ID                string                `json:"ID"`
	Namespace         string                `json:"Namespace"`
	Priority          int                   `json:"Priority"`
	Type              string                `json:"Type"`
	TriggeredBy       string                `json:"TriggeredBy"`
	JobID             string                `json:"JobID"`
	Status            string                `json:"Status"`
	StatusDescription string                `json:"StatusDescription"`
	BlockedEval       string                `json:"BlockedEval"`
	FailedTGAllocs    map[string]AllocMetrics `json:"FailedTGAllocs"`
	CreateTime        int64                 `json:"CreateTime"`
	ModifyTime        int64                 `json:"ModifyTime"`
}

// AllocMetrics explains why allocations were not placed during an evaluation.
type AllocMetrics struct {
	NodesEvaluated     int            `json:"NodesEvaluated"`
	NodesFiltered      int            `json:"NodesFiltered"`
	NodesExhausted     int            `json:"NodesExhausted"`
	DimensionExhausted map[string]int `json:"DimensionExhausted"`
	ConstraintFiltered map[string]int `json:"ConstraintFiltered"`
	QuotaExhausted     []string       `json:"QuotaExhausted"`
	CoalescedFailures  int            `json:"CoalescedFailures"`
}

// DeploymentStub summarises a Nomad rolling deployment.
type DeploymentStub struct {
	ID                string                                `json:"ID"`
	Namespace         string                                `json:"Namespace"`
	JobID             string                                `json:"JobID"`
	JobVersion        uint64                               `json:"JobVersion"`
	Status            string                                `json:"Status"`
	StatusDescription string                                `json:"StatusDescription"`
	TaskGroups        map[string]DeploymentTaskGroupSummary `json:"TaskGroups"`
	CreateTime        int64                                 `json:"CreateTime"`
	ModifyTime        int64                                 `json:"ModifyTime"`
}

// DeploymentTaskGroupSummary holds allocation health counts for one task group.
type DeploymentTaskGroupSummary struct {
	DesiredTotal    int `json:"DesiredTotal"`
	PlacedAllocs    int `json:"PlacedAllocs"`
	HealthyAllocs   int `json:"HealthyAllocs"`
	UnhealthyAllocs int `json:"UnhealthyAllocs"`
	DesiredCanaries int `json:"DesiredCanaries"`
}

// TaskEvent is a single lifecycle event for a task within an allocation.
type TaskEvent struct {
	Type           string            `json:"Type"`
	Time           int64             `json:"Time"`
	DisplayMessage string            `json:"DisplayMessage"`
	Details        map[string]string `json:"Details"`
	FailsTask      bool              `json:"FailsTask"`
}

// TaskStateDetail extends TaskState with the full event history.
type TaskStateDetail struct {
	State      string      `json:"State"`
	Failed     bool        `json:"Failed"`
	Restarts   uint64      `json:"Restarts"`
	StartedAt  string      `json:"StartedAt"`
	FinishedAt string      `json:"FinishedAt"`
	Events     []TaskEvent `json:"Events"`
}

// AllocationDetail is the full allocation response including per-task event history.
type AllocationDetail struct {
	ID            string                     `json:"ID"`
	Name          string                     `json:"Name"`
	Namespace     string                     `json:"Namespace"`
	NodeID        string                     `json:"NodeID"`
	NodeName      string                     `json:"NodeName"`
	JobID         string                     `json:"JobID"`
	TaskGroup     string                     `json:"TaskGroup"`
	DesiredStatus string                     `json:"DesiredStatus"`
	ClientStatus  string                     `json:"ClientStatus"`
	TaskStates    map[string]TaskStateDetail `json:"TaskStates"`
	CreateTime    int64                      `json:"CreateTime"`
	ModifyTime    int64                      `json:"ModifyTime"`
}
