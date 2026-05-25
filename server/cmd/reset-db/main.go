package main

import (
	"log"

	"github.com/kusumaningrat/idp-backend/internal/config"
	"github.com/kusumaningrat/idp-backend/internal/database"
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

	if err := database.ResetDatabase(db); err != nil {
		log.Fatalf("reset: %v", err)
	}

	if err := database.Seed(db, cfg); err != nil {
		log.Fatalf("seed: %v", err)
	}

	log.Println("database reset and seeded successfully")
}
