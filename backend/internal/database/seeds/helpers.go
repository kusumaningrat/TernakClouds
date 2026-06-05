package seeds

import (
	"encoding/json"

	"github.com/kusumaningrat/ternakclouds/internal/servicecatalog"
	"gorm.io/datatypes"
)

// ports serialises a list of PortDef values to the JSON column type.
func ports(defs ...servicecatalog.PortDef) datatypes.JSON {
	b, _ := json.Marshal(defs)
	return datatypes.JSON(b)
}
