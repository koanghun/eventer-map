package service

import (
	"context"
	"database/sql"
	"log"

	"eventer-map-backend/internal/auth"
	"eventer-map-backend/internal/mailer"
	"eventer-map-backend/internal/repository"
	"eventer-map-backend/internal/storage"
)

// Services holds all the domain services
type Services struct {
	Auth   *AuthService
	Event  *EventService
	User   *UserService
	Artist *ArtistService
	Venue  *VenueService
	Stats  *StatsService
	Thread *ThreadService
	db     *sql.DB
}

// NewServices initializes all domain services with the database repository
func NewServices(repo *repository.Queries, db *sql.DB) *Services {
	// SMTP when configured, otherwise MockMailer (logs to console) for development
	m := mailer.NewFromEnv()

	var uploader storage.Uploader
	if s3Storage, err := storage.NewS3StorageFromEnv(context.Background()); err != nil {
		log.Printf("WARNING: Failed to initialize S3 storage: %v", err)
	} else if s3Storage != nil {
		uploader = s3Storage
	}

	xClient := auth.NewXOAuthClientFromEnv()
	var xProvider xOAuthProvider
	if xClient != nil && xClient.IsConfigured() {
		xProvider = xClient
	}

	var stateStore auth.OAuthStateStore
	store, err := auth.NewOAuthStateStoreFromEnv(context.Background())
	if err != nil {
		log.Printf("WARNING: Failed to initialize OAuth state store: %v", err)
	} else {
		stateStore = store
	}

	return &Services{
		Auth:   NewAuthServiceWithXOAuth(repo, m, xProvider, stateStore),
		Event:  NewEventService(repo, db),
		User:   NewUserService(repo),
		Artist: NewArtistService(repo, db, uploader),
		Venue:  NewVenueService(repo, db),
		Stats:  NewStatsService(repo),
		Thread: NewThreadService(repo, db),
		db:     db,
	}
}
