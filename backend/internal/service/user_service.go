package service

import (
	"context"
	"database/sql"
	"errors"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	repo *repository.Queries
}

func NewUserService(repo *repository.Queries) *UserService {
	return &UserService{repo: repo}
}
func (s *UserService) ListUserEventActions(ctx context.Context, userID uuid.UUID) ([]repository.EventUserAction, error) {
	return s.repo.ListUserEventActions(ctx, userID)
}

func (s *UserService) FollowUser(ctx context.Context, followerID, followeeID uuid.UUID) error {
	if followerID == followeeID {
		return nil // Cannot follow self, handled mostly at handler but safe to ignore or error
	}

	// Check if blocked
	exists, err := s.repo.CheckBlockExists(ctx, repository.CheckBlockExistsParams{
		BlockerID: followerID,
		BlockedID: followeeID,
	})
	if err != nil {
		return err
	}
	if exists {
		return context.DeadlineExceeded // just a placeholder error, better to return custom error or just general error
		// Actually, let's just return a generic error or use a known error type. For now, returning an error works.
	}

	return s.repo.FollowUser(ctx, repository.FollowUserParams{
		FollowerID: followerID,
		FolloweeID: followeeID,
	})
}

func (s *UserService) UnfollowUser(ctx context.Context, followerID, followeeID uuid.UUID) error {
	return s.repo.UnfollowUser(ctx, repository.UnfollowUserParams{
		FollowerID: followerID,
		FolloweeID: followeeID,
	})
}

func (s *UserService) BlockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error {
	if blockerID == blockedID {
		return nil
	}
	// Insert block
	if err := s.repo.BlockUser(ctx, repository.BlockUserParams{
		BlockerID: blockerID,
		BlockedID: blockedID,
	}); err != nil {
		return err
	}
	// Delete mutual follows
	return s.repo.DeleteMutualFollows(ctx, repository.DeleteMutualFollowsParams{
		FollowerID: blockerID,
		FolloweeID: blockedID,
	})
}

func (s *UserService) UnblockUser(ctx context.Context, blockerID, blockedID uuid.UUID) error {
	return s.repo.UnblockUser(ctx, repository.UnblockUserParams{
		BlockerID: blockerID,
		BlockedID: blockedID,
	})
}

func (s *UserService) ListFollowing(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]repository.ListFollowingRow, error) {
	return s.repo.ListFollowing(ctx, repository.ListFollowingParams{
		FollowerID: userID,
		Limit:      limit,
		Offset:     offset,
	})
}

func (s *UserService) ListFollowers(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]repository.ListFollowersRow, error) {
	return s.repo.ListFollowers(ctx, repository.ListFollowersParams{
		FolloweeID: userID,
		Limit:      limit,
		Offset:     offset,
	})
}

func (s *UserService) ListFollowingEvents(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]repository.Event, error) {
	return s.repo.ListFollowingEvents(ctx, repository.ListFollowingEventsParams{
		FollowerID: userID,
		Limit:      limit,
		Offset:     offset,
	})
}

func (s *UserService) UpdateProfile(ctx context.Context, userID uuid.UUID, displayName string) (repository.User, error) {
	// Optional: Check if nickname already exists
	exists, err := s.repo.CheckNicknameExists(ctx, displayName)
	if err != nil {
		return repository.User{}, err
	}
	if exists {
		return repository.User{}, ErrNicknameExists // Reusing error from auth service or define one here. Actually it's better to return a specific error.
	}

	return s.repo.UpdateUserProfile(ctx, repository.UpdateUserProfileParams{
		ID:          userID,
		DisplayName: displayName,
	})
}

func (s *UserService) UpdatePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}

	if !user.PasswordHash.Valid {
		return errors.New("user does not have a password set")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(currentPassword)); err != nil {
		return errors.New("invalid current password")
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return s.repo.UpdateUserPassword(ctx, repository.UpdateUserPasswordParams{
		ID:           userID,
		PasswordHash: sql.NullString{String: string(newHash), Valid: true},
	})
}
