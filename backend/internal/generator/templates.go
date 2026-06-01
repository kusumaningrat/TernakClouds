package generator

import (
	"embed"
	"fmt"
	"text/template"
)

//go:embed templates
var templateFS embed.FS

// loadTemplate reads templates/{name}/{version} from the embedded FS and parses
// it as a Go text/template. Pass non-empty leftDelim/rightDelim to override the
// default {{ }} delimiters (e.g. "[[ ]]" for Nomad so Consul Template syntax
// passes through unchanged).
func loadTemplate(name, version, leftDelim, rightDelim string) *template.Template {
	path := fmt.Sprintf("templates/%s/%s", name, version)
	content, err := templateFS.ReadFile(path)
	if err != nil {
		panic(fmt.Sprintf("generator: missing template %s: %v", path, err))
	}
	t := template.New(name)
	if leftDelim != "" {
		t = t.Delims(leftDelim, rightDelim)
	}
	return template.Must(t.Parse(string(content)))
}
