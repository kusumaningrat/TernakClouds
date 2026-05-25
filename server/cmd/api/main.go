package main

import (
	"log"

	"github.com/kusumaningrat/idp-backend/internal/bootstrap"
	"github.com/kusumaningrat/idp-backend/internal/config"
	"github.com/kusumaningrat/idp-backend/internal/database"
	"github.com/kusumaningrat/idp-backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := database.Connect(cfg.Database.DataSource())
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	if err := database.Seed(db, cfg); err != nil {
		log.Fatalf("seed: %v", err)
	}

	vaultClient, err := bootstrap.InitVault(cfg.Vault)
	if err != nil {
		log.Fatalf("vault: %v", err)
	}

	srv := server.New(cfg, db, vaultClient)
	log.Printf("starting server on :%s", cfg.Server.Port)
	if err := srv.Run(); err != nil {
		log.Fatalf("server: %v", err)
	}
}
