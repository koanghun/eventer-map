package service

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"strings"

	"eventer-map-backend/internal/repository"
	"eventer-map-backend/internal/storage"
	"github.com/google/uuid"
)

const (
	DefaultArtistLimit int32 = 15
	MaxArtistLimit     int32 = 50
)

type CreateArtistInput struct {
	OfficialName            string
	Hiragana                *string
	Disambiguation          *string
	Gender                  string
	ProfileImage            io.Reader
	ProfileImageContentType string
	AuthorID                uuid.UUID
}

type ArtistService struct {
	repo     *repository.Queries
	db       *sql.DB
	uploader storage.Uploader
}

func NewArtistService(repo *repository.Queries, db *sql.DB, uploader storage.Uploader) *ArtistService {
	return &ArtistService{repo: repo, db: db, uploader: uploader}
}

func (s *ArtistService) ListArtists(ctx context.Context, limit int32, status string, nameKeyword string, cursorID uuid.UUID) ([]repository.Artist, error) {
	if limit <= 0 {
		limit = DefaultArtistLimit
	} else if limit > MaxArtistLimit {
		limit = MaxArtistLimit
	}

	trimmed := strings.TrimSpace(nameKeyword)

	return s.repo.ListArtists(ctx, repository.ListArtistsParams{
		Limit:       limit,
		Status:      status,
		NameKeyword: likeEscaper.Replace(trimmed),
		CursorID:    cursorID,
	})
}

func (s *ArtistService) CreateArtist(ctx context.Context, input CreateArtistInput) (*repository.Artist, error) {
	status := "PENDING"
	if user, err := s.repo.GetUserByID(ctx, input.AuthorID); err == nil && user.Role == "ADMIN" {
		status = "APPROVED"
	}

	params := repository.CreateArtistParams{
		OfficialName: strings.TrimSpace(input.OfficialName),
		Gender:       input.Gender,
		Status:       status,
		AuthorID:     uuid.NullUUID{UUID: input.AuthorID, Valid: input.AuthorID != uuid.Nil},
	}

	if input.Hiragana != nil && strings.TrimSpace(*input.Hiragana) != "" {
		params.Hiragana = sql.NullString{String: strings.TrimSpace(*input.Hiragana), Valid: true}
	}
	if input.Disambiguation != nil && strings.TrimSpace(*input.Disambiguation) != "" {
		params.Disambiguation = sql.NullString{String: strings.TrimSpace(*input.Disambiguation), Valid: true}
	}

	if input.ProfileImage != nil {
		if s.uploader == nil {
			return nil, errors.New("S3 storage is not configured")
		}
		imageURL, err := s.uploader.UploadArtistProfileImage(ctx, input.ProfileImage, input.ProfileImageContentType)
		if err != nil {
			return nil, err
		}
		params.ProfileImageUrl = sql.NullString{String: imageURL, Valid: true}
	}

	artist, err := s.repo.CreateArtist(ctx, params)
	if err != nil {
		return nil, err
	}
	return &artist, nil
}

func (s *ArtistService) GetArtist(ctx context.Context, id uuid.UUID) (*repository.Artist, error) {
	artist, err := s.repo.GetArtist(ctx, id)
	if err != nil {
		return nil, err
	}
	return &artist, nil
}

func (s *ArtistService) FollowArtist(ctx context.Context, userID, artistID uuid.UUID) error {
	return s.repo.FollowArtist(ctx, repository.FollowArtistParams{
		UserID:   userID,
		ArtistID: artistID,
	})
}

func (s *ArtistService) UnfollowArtist(ctx context.Context, userID, artistID uuid.UUID) error {
	return s.repo.UnfollowArtist(ctx, repository.UnfollowArtistParams{
		UserID:   userID,
		ArtistID: artistID,
	})
}

func (s *ArtistService) ListFollowingArtists(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]repository.Artist, error) {
	return s.repo.ListFollowingArtists(ctx, repository.ListFollowingArtistsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

func (s *ArtistService) ListArtistFollowers(ctx context.Context, artistID uuid.UUID, limit, offset int32) ([]repository.ListArtistFollowersRow, error) {
	return s.repo.ListArtistFollowers(ctx, repository.ListArtistFollowersParams{
		ArtistID: artistID,
		Limit:    limit,
		Offset:   offset,
	})
}

func (s *ArtistService) ListFollowingArtistEvents(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]repository.Event, error) {
	return s.repo.ListFollowingArtistEvents(ctx, repository.ListFollowingArtistEventsParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

func (s *ArtistService) CountUnreadFollowingArtistEvents(ctx context.Context, userID uuid.UUID) (int, error) {
	count, err := s.repo.CountUnreadFollowingArtistEvents(ctx, userID)
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

func (s *ArtistService) GetLastArtistFeedCheckedAt(ctx context.Context, userID uuid.UUID) (string, error) {
	checkedAt, err := s.repo.GetLastArtistFeedCheckedAt(ctx, userID)
	if err != nil {
		return "", err
	}
	return checkedAt.Format("2006-01-02T15:04:05Z07:00"), nil
}

func (s *ArtistService) UpdateLastArtistFeedCheckedAt(ctx context.Context, userID uuid.UUID) error {
	return s.repo.UpdateLastArtistFeedCheckedAt(ctx, userID)
}

func (s *ArtistService) CanUpdateArtist(ctx context.Context, artistID, userID uuid.UUID, userRole string) error {
	// ADMIN can always update
	if userRole == "ADMIN" {
		return nil
	}

	artist, err := s.repo.GetArtist(ctx, artistID)
	if err != nil {
		return err
	}

	if artist.Status == "APPROVED" {
		return errors.New("only admins can update approved artists directly. Users should use modification proposals")
	}

	// Only author can update their own PENDING artist
	if artist.AuthorID.UUID != userID {
		return errors.New("only the author or admin can update this artist")
	}

	return nil
}
