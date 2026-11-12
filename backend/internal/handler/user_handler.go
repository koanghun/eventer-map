package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"eventer-map-backend/internal/auth"
	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/repository"
	"eventer-map-backend/internal/service"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func respondUserProfile(w http.ResponseWriter, user *repository.User) {
	var email *openapi_types.Email
	if user.Email.Valid && user.Email.String != "" {
		e := openapi_types.Email(user.Email.String)
		email = &e
	}

	var xUsername *string
	if user.XUsername.Valid && user.XUsername.String != "" {
		u := user.XUsername.String
		xUsername = &u
	}

	id := openapi_types.UUID(user.ID)
	displayName := user.DisplayName
	createdAt := user.CreatedAt
	isGoogleLinked := user.GoogleID.Valid
	isXLinked := user.XID.Valid
	hasPassword := user.PasswordHash.Valid

	resp := UserProfile{
		Id:             &id,
		Email:          email,
		DisplayName:    &displayName,
		CreatedAt:      &createdAt,
		IsGoogleLinked: &isGoogleLinked,
		IsXLinked:      &isXLinked,
		XUsername:      xUsername,
		HasPassword:    &hasPassword,
	}
	if role := UserProfileRole(user.Role); role.Valid() {
		resp.Role = &role
	}

	RespondJSON(w, http.StatusOK, resp)
}

// GetUsersMe returns the profile of the currently authenticated user
func (s *Server) GetUsersMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	user, err := s.services.Auth.GetUserByID(r.Context(), userID)
	if err != nil {
		RespondError(w, http.StatusNotFound, "user not found")
		return
	}

	respondUserProfile(w, user)
}

// GetUsersMeEvents implements the GET /users/me/events endpoint
func (s *Server) GetUsersMeEvents(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	actions, err := s.services.User.ListUserEventActions(r.Context(), userID)
	if err != nil {
		log.Printf("[GetUsersMeEvents] ListUserEventActions error (userID=%s): %v", userID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve events")
		return
	}

	// Map to API response
	var response []UserEventAction
	for _, a := range actions {
		item := UserEventAction{
			EventId: a.EventID,
			Status:  UserEventActionStatus(a.Status),
		}
		if a.Rating.Valid {
			rVal := int(a.Rating.Int32)
			item.Rating = &rVal
		}
		response = append(response, item)
	}
	if response == nil {
		response = []UserEventAction{}
	}

	RespondJSON(w, http.StatusOK, response)
}

// PostUsersUserIdFollow implements the POST /users/{userId}/follow endpoint
func (s *Server) PostUsersUserIdFollow(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.FollowUser(r.Context(), myID, userId); err != nil {
		RespondError(w, http.StatusBadRequest, "Follow failed or blocked")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Followed successfully"})
}

// DeleteUsersUserIdFollow implements the DELETE /users/{userId}/follow endpoint
func (s *Server) DeleteUsersUserIdFollow(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.UnfollowUser(r.Context(), myID, userId); err != nil {
		log.Printf("[DeleteUsersUserIdFollow] UnfollowUser error (myID=%s, userID=%s): %v", myID, userId, err)
		RespondError(w, http.StatusInternalServerError, "Unfollow failed")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Unfollowed successfully"})
}

// PostUsersUserIdBlock implements the POST /users/{userId}/block endpoint
func (s *Server) PostUsersUserIdBlock(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.BlockUser(r.Context(), myID, userId); err != nil {
		log.Printf("[PostUsersUserIdBlock] BlockUser error (myID=%s, userID=%s): %v", myID, userId, err)
		RespondError(w, http.StatusInternalServerError, "Block failed")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Blocked successfully"})
}

// DeleteUsersUserIdBlock implements the DELETE /users/{userId}/block endpoint
func (s *Server) DeleteUsersUserIdBlock(w http.ResponseWriter, r *http.Request, userId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.User.UnblockUser(r.Context(), myID, userId); err != nil {
		log.Printf("[DeleteUsersUserIdBlock] UnblockUser error (myID=%s, userID=%s): %v", myID, userId, err)
		RespondError(w, http.StatusInternalServerError, "Unblock failed")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Unblocked successfully"})
}

// GetUsersUserIdFollowers implements the GET /users/{userId}/followers endpoint
func (s *Server) GetUsersUserIdFollowers(w http.ResponseWriter, r *http.Request, userId uuid.UUID, params GetUsersUserIdFollowersParams) {
	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	followers, err := s.services.User.ListFollowers(r.Context(), userId, limit, offset)
	if err != nil {
		log.Printf("[GetUsersUserIdFollowers] ListFollowers error (userID=%s): %v", userId, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve followers")
		return
	}

	response := make([]UserProfile, 0)
	for _, f := range followers {
		id := openapi_types.UUID(f.ID)
		name := f.DisplayName
		t := f.CreatedAt
		response = append(response, UserProfile{
			Id:          &id,
			DisplayName: &name,
			CreatedAt:   &t,
		})
	}
	RespondJSON(w, http.StatusOK, response)
}

// GetUsersMeFollowing implements the GET /users/me/following endpoint
func (s *Server) GetUsersMeFollowing(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	following, err := s.services.User.ListFollowing(r.Context(), myID, limit, offset)
	if err != nil {
		log.Printf("[GetUsersMeFollowing] ListFollowing error (userID=%s): %v", myID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve following")
		return
	}

	response := make([]UserProfile, 0)
	for _, f := range following {
		id := openapi_types.UUID(f.ID)
		name := f.DisplayName
		t := f.CreatedAt
		response = append(response, UserProfile{
			Id:          &id,
			DisplayName: &name,
			CreatedAt:   &t,
		})
	}
	RespondJSON(w, http.StatusOK, response)
}

// GetUsersMeFollowingEvents implements the GET /users/me/following-events endpoint
func (s *Server) GetUsersMeFollowingEvents(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingEventsParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	events, err := s.services.User.ListFollowingEvents(r.Context(), myID, limit, offset)
	if err != nil {
		log.Printf("[GetUsersMeFollowingEvents] ListFollowingEvents error (userID=%s): %v", myID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve following events")
		return
	}

	response := make([]EventSummary, 0)
	for _, e := range events {
		response = append(response, EventSummary{
			Id:        &e.ID,
			Title:     &e.Title,
			VenueId:   &e.VenueID.UUID, // e.VenueID is uuid.NullUUID, assuming valid
			StartTime: &e.StartTime,
			EndTime:   &e.EndTime,
			Rating:    nil, // Calculate if needed
		})
	}
	RespondJSON(w, http.StatusOK, response)
}

// GetUsersMeFollowingArtists implements the GET /users/me/following-artists endpoint
func (s *Server) GetUsersMeFollowingArtists(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingArtistsParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	artists, err := s.services.Artist.ListFollowingArtists(r.Context(), myID, limit, offset)
	if err != nil {
		log.Printf("[GetUsersMeFollowingArtists] ListFollowingArtists error (userID=%s): %v", myID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve following artists")
		return
	}

	response := make([]Artist, 0)
	for _, a := range artists {
		id := openapi_types.UUID(a.ID)
		officialName := a.OfficialName
		gender := ArtistGender(a.Gender)
		status := ArtistStatus(a.Status)

		var hiragana *string
		if a.Hiragana.Valid {
			h := a.Hiragana.String
			hiragana = &h
		}
		var disambiguation *string
		if a.Disambiguation.Valid && a.Disambiguation.String != "" {
			d := a.Disambiguation.String
			disambiguation = &d
		}
		var profileImageURL *string
		if a.ProfileImageUrl.Valid {
			p := a.ProfileImageUrl.String
			profileImageURL = &p
		}
		ratingCount := int(a.RatingCount)
		var rating *float64
		if a.RatingCount > 0 {
			avg := a.RatingSum / float64(a.RatingCount)
			rating = &avg
		}

		response = append(response, Artist{
			Id:              &id,
			OfficialName:    &officialName,
			Hiragana:        hiragana,
			Disambiguation:  disambiguation,
			Gender:          &gender,
			ProfileImageUrl: profileImageURL,
			Rating:          rating,
			RatingCount:     &ratingCount,
			Status:          &status,
		})
	}
	RespondJSON(w, http.StatusOK, response)
}

// GetUsersMeFollowingArtistsEvents implements the GET /users/me/following-artists/events endpoint
func (s *Server) GetUsersMeFollowingArtistsEvents(w http.ResponseWriter, r *http.Request, params GetUsersMeFollowingArtistsEventsParams) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}
	unreadOnly := params.UnreadOnly != nil && *params.UnreadOnly

	feed, err := s.services.Artist.GetFollowingArtistsEventFeed(r.Context(), myID, unreadOnly, limit, offset)
	if err != nil {
		log.Printf("[GetUsersMeFollowingArtistsEvents] GetFollowingArtistsEventFeed error (userID=%s): %v", myID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve artist events")
		return
	}

	responseEvents := make([]FollowingArtistNotificationEvent, 0, len(feed.Events))
	for _, row := range feed.Events {
		summary := mapListEventRowToSummary(repository.ListEventsRow{
			ID:                       row.ID,
			Title:                    row.Title,
			VenueID:                  row.VenueID,
			VenueName:                row.VenueName,
			Latitude:                 row.Latitude,
			Longitude:                row.Longitude,
			StartTime:                row.StartTime,
			EndTime:                  row.EndTime,
			RatingSum:                row.RatingSum,
			RatingCount:              row.RatingCount,
			AttendeeCount:            row.AttendeeCount,
			Status:                   row.Status,
			TopArtistName:            row.TopArtistName,
			TopArtistProfileImageUrl: row.TopArtistProfileImageUrl,
		})

		var status *FollowingArtistNotificationEventStatus
		if summary.Status != nil {
			st := FollowingArtistNotificationEventStatus(*summary.Status)
			status = &st
		}
		createdAt := row.CreatedAt
		matchedNames := make([]string, len(row.MatchedArtistNames))
		copy(matchedNames, row.MatchedArtistNames)

		responseEvents = append(responseEvents, FollowingArtistNotificationEvent{
			Id:                       summary.Id,
			Title:                    summary.Title,
			VenueId:                  summary.VenueId,
			VenueName:                summary.VenueName,
			Latitude:                 summary.Latitude,
			Longitude:                summary.Longitude,
			StartTime:                summary.StartTime,
			EndTime:                  summary.EndTime,
			Rating:                   summary.Rating,
			AttendeeCount:            summary.AttendeeCount,
			TopArtistName:            summary.TopArtistName,
			TopArtistProfileImageUrl: summary.TopArtistProfileImageUrl,
			Status:                   status,
			CreatedAt:                &createdAt,
			MatchedArtistNames:       &matchedNames,
		})
	}

	response := struct {
		Events      []FollowingArtistNotificationEvent `json:"events"`
		UnreadCount int                                `json:"unreadCount"`
		CheckedAt   time.Time                          `json:"checkedAt"`
		FetchedAt   time.Time                          `json:"fetchedAt"`
	}{
		Events:      responseEvents,
		UnreadCount: feed.UnreadCount,
		CheckedAt:   feed.CheckedAt,
		FetchedAt:   feed.FetchedAt,
	}

	RespondJSON(w, http.StatusOK, response)
}

// PostUsersMeFollowingArtistsEventsRead implements the POST /users/me/following-artists/events/read endpoint
func (s *Server) PostUsersMeFollowingArtistsEventsRead(w http.ResponseWriter, r *http.Request) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var readBefore *time.Time
	if r.Body != nil {
		var body PostUsersMeFollowingArtistsEventsReadJSONRequestBody
		err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body)
		if err != nil && !errors.Is(err, io.EOF) {
			RespondError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		readBefore = body.ReadBefore
	}

	if err := s.services.Artist.UpdateLastArtistFeedCheckedAt(r.Context(), myID, readBefore); err != nil {
		log.Printf("[PostUsersMeFollowingArtistsEventsRead] UpdateLastArtistFeedCheckedAt error (userID=%s): %v", myID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to update read timestamp")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Feed marked as read"})
}

// PatchUsersMe implements the PATCH /users/me endpoint
func (s *Server) PatchUsersMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	user, err := s.services.User.UpdateProfile(r.Context(), userID, req.DisplayName)
	if err != nil {
		if err.Error() == "nickname already exists" { // assuming ErrNicknameExists is not easily imported if it was not exported, wait it is in same package
			RespondError(w, http.StatusBadRequest, "Nickname already exists")
			return
		}
		log.Printf("[PatchUsersMe] UpdateProfile error (userID=%s): %v", userID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}

	respondUserProfile(w, &user)
}

// DeleteUsersMe implements the DELETE /users/me endpoint
func (s *Server) DeleteUsersMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var req DeleteAccountRequest
	if r.Body != nil {
		// An empty body is allowed (Google-only accounts have no password).
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
			RespondError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}
	}
	currentPassword := ""
	if req.CurrentPassword != nil {
		currentPassword = *req.CurrentPassword
	}

	googleID := ""
	if req.GoogleAccessToken != nil && *req.GoogleAccessToken != "" {
		id, _, err := s.services.Auth.VerifyGoogleAccessToken(r.Context(), *req.GoogleAccessToken)
		if err != nil {
			RespondErrorCode(w, http.StatusForbidden, "REAUTH_REQUIRED", "Re-authentication required")
			return
		}
		googleID = id
	}

	xID := ""
	if req.XReauthToken != nil && *req.XReauthToken != "" {
		id, err := s.services.Auth.VerifyXReauthToken(r.Context(), userID, *req.XReauthToken)
		if err != nil {
			RespondErrorCode(w, http.StatusForbidden, "REAUTH_REQUIRED", "Re-authentication required")
			return
		}
		xID = id
	}

	if err := s.services.User.DeleteAccount(r.Context(), userID, currentPassword, googleID, xID); err != nil {
		if errors.Is(err, service.ErrInvalidCurrentPassword) {
			RespondErrorCode(w, http.StatusBadRequest, "INVALID_CURRENT_PASSWORD", "Invalid current password")
			return
		}
		if errors.Is(err, service.ErrReauthRequired) {
			RespondErrorCode(w, http.StatusForbidden, "REAUTH_REQUIRED", "Re-authentication required")
			return
		}
		log.Printf("[DeleteUsersMe] DeleteAccount error (userID=%s): %v", userID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to delete account")
		return
	}

	// Clear the refresh token cookie
	http.SetCookie(w, buildRefreshTokenCookie("", time.Unix(0, 0), -1))

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Account deleted successfully",
	})
}

// PutUsersMePassword implements the PUT /users/me/password endpoint
func (s *Server) PutUsersMePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var req UpdatePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	currentPassword := ""
	if req.CurrentPassword != nil {
		currentPassword = *req.CurrentPassword
	}

	err := s.services.User.UpdatePassword(r.Context(), userID, currentPassword, req.NewPassword)
	if err != nil {
		if errors.Is(err, service.ErrEmailRequiredForPassword) {
			RespondErrorCode(w, http.StatusBadRequest, "EMAIL_REQUIRED_FOR_PASSWORD", "Email is required to set a password")
			return
		}
		if err.Error() == "invalid current password" {
			RespondError(w, http.StatusBadRequest, "Invalid current password")
			return
		}
		log.Printf("[PutUsersMePassword] UpdatePassword error (userID=%s): %v", userID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to update password")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Password updated successfully",
	})
}

// PostUsersMeLinkGoogle implements the POST /users/me/link-google endpoint
func (s *Server) PostUsersMeLinkGoogle(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var req LinkGoogleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	err := s.services.Auth.LinkGoogleAccount(r.Context(), userID, req.IdToken, true)
	if err != nil {
		if err.Error() == "this google account is already linked to another user" {
			RespondError(w, http.StatusConflict, err.Error())
			return
		}
		if err.Error() == "invalid google token" {
			RespondError(w, http.StatusUnauthorized, err.Error())
			return
		}
		log.Printf("[PostUsersMeLinkGoogle] LinkGoogleAccount error (userID=%s): %v", userID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to link Google account")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Google account linked successfully",
	})
}

// PostUsersMeUnlinkGoogle implements the POST /users/me/unlink-google endpoint
func (s *Server) PostUsersMeUnlinkGoogle(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	err := s.services.Auth.UnlinkGoogleAccount(r.Context(), userID)
	if err != nil {
		if errors.Is(err, service.ErrCannotUnlinkLastAuth) {
			RespondErrorCode(w, http.StatusBadRequest, "CANNOT_UNLINK_LAST_AUTH", "Cannot unlink the last login method")
			return
		}
		log.Printf("[PostUsersMeUnlinkGoogle] UnlinkGoogleAccount error (userID=%s): %v", userID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to unlink Google account")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "Google account unlinked successfully",
	})
}

// PostUsersMeLinkXAuthorize implements the POST /users/me/link-x/authorize endpoint.
func (s *Server) PostUsersMeLinkXAuthorize(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	authorizeURL, err := s.services.Auth.StartXOAuth(r.Context(), auth.ModeLink, &userID)
	if err != nil {
		handleXOAuthError(w, "PostUsersMeLinkXAuthorize", err)
		return
	}

	RespondJSON(w, http.StatusOK, XOAuthAuthorizeResponse{
		AuthorizeUrl: authorizeURL,
	})
}

// PostUsersMeLinkX implements the POST /users/me/link-x endpoint.
func (s *Server) PostUsersMeLinkX(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var req PostUsersMeLinkXJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	if err := s.services.Auth.LinkXAccount(r.Context(), userID, req.Code, req.State); err != nil {
		handleXOAuthError(w, "PostUsersMeLinkX", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "X account linked successfully",
	})
}

// PostUsersMeUnlinkX implements the POST /users/me/unlink-x endpoint.
func (s *Server) PostUsersMeUnlinkX(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	if err := s.services.Auth.UnlinkXAccount(r.Context(), userID); err != nil {
		handleXOAuthError(w, "PostUsersMeUnlinkX", err)
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{
		"message": "X account unlinked successfully",
	})
}

// PostUsersMeReauthXAuthorize implements the POST /users/me/reauth-x/authorize endpoint.
func (s *Server) PostUsersMeReauthXAuthorize(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	authorizeURL, err := s.services.Auth.StartXOAuth(r.Context(), auth.ModeReauth, &userID)
	if err != nil {
		handleXOAuthError(w, "PostUsersMeReauthXAuthorize", err)
		return
	}

	RespondJSON(w, http.StatusOK, XOAuthAuthorizeResponse{
		AuthorizeUrl: authorizeURL,
	})
}

// PostUsersMeReauthX implements the POST /users/me/reauth-x endpoint.
func (s *Server) PostUsersMeReauthX(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var req PostUsersMeReauthXJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}

	reauthToken, err := s.services.Auth.CompleteXReauth(r.Context(), userID, req.Code, req.State)
	if err != nil {
		handleXOAuthError(w, "PostUsersMeReauthX", err)
		return
	}

	RespondJSON(w, http.StatusOK, XReauthResponse{
		XReauthToken: reauthToken,
	})
}
