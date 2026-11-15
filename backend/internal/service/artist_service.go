package service

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"strings"
	"time"

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

type artistFeedRepository interface {
	GetLastArtistFeedCheckedAt(ctx context.Context, id uuid.UUID) (repository.GetLastArtistFeedCheckedAtRow, error)
	ListFollowingArtistEvents(ctx context.Context, arg repository.ListFollowingArtistEventsParams) ([]repository.ListFollowingArtistEventsRow, error)
	CountUnreadFollowingArtistEvents(ctx context.Context, userID uuid.UUID) (int64, error)
	UpdateLastArtistFeedCheckedAt(ctx context.Context, arg repository.UpdateLastArtistFeedCheckedAtParams) error
}

type ArtistService struct {
	repo     *repository.Queries
	feedRepo artistFeedRepository
	db       *sql.DB
	uploader storage.Uploader
}

func NewArtistService(repo *repository.Queries, db *sql.DB, uploader storage.Uploader) *ArtistService {
	var feedRepo artistFeedRepository
	if repo != nil {
		feedRepo = repo
	}
	return &ArtistService{repo: repo, feedRepo: feedRepo, db: db, uploader: uploader}
}

func newArtistServiceWithFeedRepo(feedRepo artistFeedRepository) *ArtistService {
	return &ArtistService{feedRepo: feedRepo}
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
	if user, err := s.repo.GetUserByID(ctx, input.AuthorID); err == nil {
		if user.IsBanned {
			return nil, ErrUserBanned
		}
		if user.Role == "ADMIN" {
			status = "APPROVED"
		}
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

type FollowingArtistFeedResult struct {
	Events      []repository.ListFollowingArtistEventsRow
	UnreadCount int
	CheckedAt   time.Time
	FetchedAt   time.Time
}

func (s *ArtistService) GetFollowingArtistsEventFeed(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit, offset int32) (*FollowingArtistFeedResult, error) {
	if limit <= 0 {
		limit = 20
	} else if limit > MaxArtistLimit {
		limit = MaxArtistLimit
	}
	if offset < 0 {
		offset = 0
	}

	times, err := s.feedRepo.GetLastArtistFeedCheckedAt(ctx, userID)
	if err != nil {
		return nil, err
	}

	events, err := s.feedRepo.ListFollowingArtistEvents(ctx, repository.ListFollowingArtistEventsParams{
		UserID:     userID,
		UnreadOnly: unreadOnly,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, err
	}

	unreadCount, err := s.feedRepo.CountUnreadFollowingArtistEvents(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &FollowingArtistFeedResult{
		Events:      events,
		UnreadCount: int(unreadCount),
		CheckedAt:   times.LastArtistFeedCheckedAt,
		FetchedAt:   times.FetchedAt,
	}, nil
}

func (s *ArtistService) UpdateLastArtistFeedCheckedAt(ctx context.Context, userID uuid.UUID, readBefore *time.Time) error {
	var rb sql.NullTime
	if readBefore != nil {
		rb = sql.NullTime{Time: readBefore.UTC(), Valid: true}
	}
	return s.feedRepo.UpdateLastArtistFeedCheckedAt(ctx, repository.UpdateLastArtistFeedCheckedAtParams{
		ID:         userID,
		ReadBefore: rb,
	})
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

var ErrEntityInUse = errors.New("entity is referenced by existing events")

func (s *ArtistService) UpdateArtist(ctx context.Context, artistID uuid.UUID, input CreateArtistInput) (*repository.Artist, error) {
	user, err := s.repo.GetUserByID(ctx, input.AuthorID)
	if err != nil {
		return nil, err
	}
	if user.IsBanned {
		return nil, ErrUserBanned
	}
	if err := s.CanUpdateArtist(ctx, artistID, input.AuthorID, user.Role); err != nil {
		return nil, ErrForbidden
	}

	params := repository.UpdateArtistParams{
		ID:           artistID,
		OfficialName: sql.NullString{String: strings.TrimSpace(input.OfficialName), Valid: strings.TrimSpace(input.OfficialName) != ""},
		Gender:       sql.NullString{String: input.Gender, Valid: input.Gender != ""},
	}
	if input.Hiragana != nil {
		params.Hiragana = sql.NullString{String: strings.TrimSpace(*input.Hiragana), Valid: true}
	}
	if input.Disambiguation != nil {
		params.Disambiguation = sql.NullString{String: strings.TrimSpace(*input.Disambiguation), Valid: true}
	}
	if input.ProfileImage != nil && s.uploader != nil {
		imageURL, err := s.uploader.UploadArtistProfileImage(ctx, input.ProfileImage, input.ProfileImageContentType)
		if err != nil {
			return nil, err
		}
		params.ProfileImageUrl = sql.NullString{String: imageURL, Valid: true}
	}

	updated, err := s.repo.UpdateArtist(ctx, params)
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

func (s *ArtistService) DeleteArtist(ctx context.Context, artistID, userID uuid.UUID) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if user.IsBanned {
		return ErrUserBanned
	}
	if err := s.CanUpdateArtist(ctx, artistID, userID, user.Role); err != nil {
		return ErrForbidden
	}
	inUse, err := s.repo.CheckArtistInEvent(ctx, artistID)
	if err != nil {
		return err
	}
	if inUse {
		return ErrEntityInUse
	}
	return s.repo.DeleteArtist(ctx, artistID)
}

func (s *ArtistService) ApproveArtist(ctx context.Context, artistID, userID uuid.UUID) (*repository.Artist, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user.IsBanned {
		return nil, ErrUserBanned
	}
	if user.Role != "ADMIN" {
		return nil, ErrForbidden
	}
	approved, err := s.repo.ApproveArtist(ctx, artistID)
	if err != nil {
		return nil, err
	}
	return &approved, nil
}
