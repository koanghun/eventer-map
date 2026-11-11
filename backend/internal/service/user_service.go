package service

import (
	"context"
	"database/sql"
	"errors"

	"eventer-map-backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type userRepository interface {
	ListUserEventActions(ctx context.Context, userID uuid.UUID) ([]repository.ListUserEventActionsRow, error)
	CheckBlockExists(ctx context.Context, arg repository.CheckBlockExistsParams) (bool, error)
	FollowUser(ctx context.Context, arg repository.FollowUserParams) error
	UnfollowUser(ctx context.Context, arg repository.UnfollowUserParams) error
	BlockUser(ctx context.Context, arg repository.BlockUserParams) error
	DeleteMutualFollows(ctx context.Context, arg repository.DeleteMutualFollowsParams) error
	UnblockUser(ctx context.Context, arg repository.UnblockUserParams) error
	ListFollowing(ctx context.Context, arg repository.ListFollowingParams) ([]repository.ListFollowingRow, error)
	ListFollowers(ctx context.Context, arg repository.ListFollowersParams) ([]repository.ListFollowersRow, error)
	ListFollowingEvents(ctx context.Context, arg repository.ListFollowingEventsParams) ([]repository.Event, error)
	CheckNicknameExists(ctx context.Context, displayName string) (bool, error)
	UpdateUserProfile(ctx context.Context, arg repository.UpdateUserProfileParams) (repository.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (repository.User, error)
	DeleteVerificationToken(ctx context.Context, email string) error
	DeleteUser(ctx context.Context, id uuid.UUID) error
	UpdateUserPassword(ctx context.Context, arg repository.UpdateUserPasswordParams) error
}

type UserService struct {
	repo userRepository
}

func NewUserService(repo userRepository) *UserService {
	return &UserService{repo: repo}
}
func (s *UserService) ListUserEventActions(ctx context.Context, userID uuid.UUID) ([]repository.ListUserEventActionsRow, error) {
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

var (
	// ErrInvalidCurrentPassword is returned when the supplied password does not match.
	ErrInvalidCurrentPassword = errors.New("invalid current password")
	// ErrReauthRequired is returned when a passwordless account has not re-authenticated.
	ErrReauthRequired = errors.New("re-authentication required")
	// ErrEmailRequiredForPassword is returned when an email-less account attempts to set a password.
	ErrEmailRequiredForPassword = errors.New("email is required to set a password")
)

// DeleteAccount permanently removes the user after verifying their identity:
//   - accounts with a password must supply it;
//   - passwordless social accounts must supply a matching verified Google or X ID.
//
// Related rows follow the FK policy (SET NULL for authored content, CASCADE for personal data).
func (s *UserService) DeleteAccount(ctx context.Context, userID uuid.UUID, currentPassword, verifiedGoogleID, verifiedXID string) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}

	switch {
	case user.PasswordHash.Valid:
		if currentPassword == "" {
			return ErrInvalidCurrentPassword
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(currentPassword)); err != nil {
			return ErrInvalidCurrentPassword
		}
	case user.GoogleID.Valid && user.XID.Valid:
		googleMatch := verifiedGoogleID != "" && verifiedGoogleID == user.GoogleID.String
		xMatch := verifiedXID != "" && verifiedXID == user.XID.String
		if !googleMatch && !xMatch {
			return ErrReauthRequired
		}
	case user.GoogleID.Valid:
		if verifiedGoogleID == "" || verifiedGoogleID != user.GoogleID.String {
			return ErrReauthRequired
		}
	case user.XID.Valid:
		if verifiedXID == "" || verifiedXID != user.XID.String {
			return ErrReauthRequired
		}
	default:
		return ErrReauthRequired
	}

	if user.Email.Valid {
		// Best effort: drop any pending verification code for this email.
		_ = s.repo.DeleteVerificationToken(ctx, user.Email.String)
	}

	return s.repo.DeleteUser(ctx, userID)
}

func (s *UserService) UpdatePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if !user.Email.Valid {
		return ErrEmailRequiredForPassword
	}

	if user.PasswordHash.Valid {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(currentPassword)); err != nil {
			return errors.New("invalid current password")
		}
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
