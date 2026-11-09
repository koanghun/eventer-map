package service

import (
	"context"
	"database/sql"
	"log"

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
	db     *sql.DB
}

// NewServices initializes all domain services with the database repository
func NewServices(repo *repository.Queries, db *sql.DB) *Services {
	// Use MockMailer for development
	m := mailer.NewMockMailer()

	var uploader storage.Uploader
	if s3Storage, err := storage.NewS3StorageFromEnv(context.Background()); err != nil {
		log.Printf("WARNING: Failed to initialize S3 storage: %v", err)
	} else if s3Storage != nil {
		uploader = s3Storage
	}

	return &Services{
		Auth:   NewAuthService(repo, m),
		Event:  NewEventService(repo, db),
		User:   NewUserService(repo),
		Artist: NewArtistService(repo, db, uploader),
		Venue:  NewVenueService(repo, db),
		Stats:  NewStatsService(repo),
		db:     db,
	}
}
