package service

import (
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
}

// NewServices initializes all domain services with the database repository
func NewServices(repo *repository.Queries) *Services {
	// Use MockMailer for development
	m := mailer.NewMockMailer()
	
	return &Services{
		Auth:   NewAuthService(repo, m),
		Event:  NewEventService(repo),
		User:   NewUserService(repo),
		Artist: NewArtistService(repo),
		Venue:  NewVenueService(repo),
		Stats:  NewStatsService(repo),
	}
}


