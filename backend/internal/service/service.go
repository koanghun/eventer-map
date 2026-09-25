package service

import (
	"database/sql"
	"eventer-map-backend/internal/mailer"
	"eventer-map-backend/internal/repository"
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

	return &Services{
		Auth:   NewAuthService(repo, m),
		Event:  NewEventService(repo),
		User:   NewUserService(repo),
		Artist: NewArtistService(repo, db),
		Venue:  NewVenueService(repo, db),
		Stats:  NewStatsService(repo),
		db:     db,
	}
}
