package service

import (
	"context"

	"eventer-map-backend/internal/repository"
)

// Services holds all the domain services
type Services struct {
	Event  *EventService
	User   *UserService
	Artist *ArtistService
	Venue  *VenueService
}

// NewServices initializes all domain services with the database repository
func NewServices(repo *repository.Queries) *Services {
	return &Services{
		Event:  &EventService{repo: repo},
		User:   &UserService{repo: repo},
		Artist: &ArtistService{repo: repo},
		Venue:  &VenueService{repo: repo},
	}
}

// EventService handles business logic for events
type EventService struct {
	repo *repository.Queries
}

func (s *EventService) Ping(ctx context.Context) string {
	return "pong from EventService"
}

// UserService handles business logic for users
type UserService struct {
	repo *repository.Queries
}

// ArtistService handles business logic for artists
type ArtistService struct {
	repo *repository.Queries
}

// VenueService handles business logic for venues
type VenueService struct {
	repo *repository.Queries
}
