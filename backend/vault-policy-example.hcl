path "secret/data/idp/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "secret/metadata/idp/*" {
  capabilities = ["delete", "list"]
}