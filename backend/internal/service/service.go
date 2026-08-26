package service

import (
	"eventer-map-backend/internal/repository"
)

// Services holds all the domain services
type Services struct {
	Auth   *AuthService
	Event  *EventService
	User   *UserService
	Artist *ArtistService
	Venue  *VenueService
}

// NewServices initializes all domain services with the database repository
func NewServices(repo *repository.Queries) *Services {
	return &Services{
		Auth:   NewAuthService(repo),
		Event:  NewEventService(repo),
		User:   NewUserService(repo),
		Artist: NewArtistService(repo),
		Venue:  NewVenueService(repo),
	}
}


