package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
)

const (
	DefaultVenueSearchLimit int32 = 10
	MaxVenueSearchLimit     int32 = 20
)

type CreateVenueInput struct {
	OfficialName string
	GoogleMapID  string
	Address      string
	Latitude     float64
	Longitude    float64
	RelatedLinks []string
	Capacity     *int32
	AuthorID     uuid.UUID
}

var likeEscaper = strings.NewReplacer(`%`, `\%`, `_`, `\_`)

type VenueService struct {
	repo *repository.Queries
	db   *sql.DB
}

func NewVenueService(repo *repository.Queries, db *sql.DB) *VenueService {
	return &VenueService{repo: repo, db: db}
}

func (s *VenueService) SearchVenues(ctx context.Context, query string, limit int32) ([]repository.SearchVenuesRow, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return []repository.SearchVenuesRow{}, nil
	}

	if limit <= 0 {
		limit = DefaultVenueSearchLimit
	} else if limit > MaxVenueSearchLimit {
		limit = MaxVenueSearchLimit
	}

	return s.repo.SearchVenues(ctx, repository.SearchVenuesParams{
		Query: likeEscaper.Replace(trimmed),
		Limit: limit,
	})
}

func (s *VenueService) ListVenuesByBoundingBox(ctx context.Context, minLat, maxLat, minLng, maxLng float64, status, nameKeyword string) ([]repository.Venue, error) {
	return s.repo.ListVenuesByBoundingBox(ctx, repository.ListVenuesByBoundingBoxParams{
		Limit:    100,
		MinLat:   minLat,
		MaxLat:   maxLat,
		MinLon:   minLng, // Map Lng to Lon
		MaxLon:   maxLng, // Map Lng to Lon
		Status:   status,
		CursorID: uuid.Nil,
	})
}

func (s *VenueService) CreateVenue(ctx context.Context, input CreateVenueInput) (*repository.Venue, error) {
	status := "PENDING"
	if user, err := s.repo.GetUserByID(ctx, input.AuthorID); err == nil && user.Role == "ADMIN" {
		status = "APPROVED"
	}

	relatedLinks := input.RelatedLinks
	if relatedLinks == nil {
		relatedLinks = []string{}
	}

	params := repository.CreateVenueParams{
		OfficialName: strings.TrimSpace(input.OfficialName),
		GoogleMapID:  strings.TrimSpace(input.GoogleMapID),
		Address:      strings.TrimSpace(input.Address),
		Latitude:     input.Latitude,
		Longitude:    input.Longitude,
		RelatedLinks: relatedLinks,
		Status:       status,
		AuthorID:     uuid.NullUUID{UUID: input.AuthorID, Valid: input.AuthorID != uuid.Nil},
	}

	if input.Capacity != nil && *input.Capacity > 0 {
		params.Capacity = sql.NullInt32{Int32: *input.Capacity, Valid: true}
	}

	venue, err := s.repo.CreateVenue(ctx, params)
	if err != nil {
		return nil, err
	}
	return &venue, nil
}

func (s *VenueService) GetVenue(ctx context.Context, id uuid.UUID) (*repository.Venue, error) {
	venue, err := s.repo.GetVenue(ctx, id)
	if err != nil {
		return nil, err
	}
	return &venue, nil
}

func (s *VenueService) CanUpdateVenue(ctx context.Context, venueID, userID uuid.UUID, userRole string) error {
	// ADMIN can always update
	if userRole == "ADMIN" {
		return nil
	}

	venue, err := s.repo.GetVenue(ctx, venueID)
	if err != nil {
		return err
	}

	if venue.Status == "APPROVED" {
		return errors.New("only admins can update approved venues directly. Users should use modification proposals")
	}

	// Only author can update their own PENDING venue
	if venue.AuthorID.UUID != userID {
		return errors.New("only the author or admin can update this venue")
	}

	return nil
}
