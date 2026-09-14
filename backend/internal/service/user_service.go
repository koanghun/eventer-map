package service

import (
	"context"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
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

