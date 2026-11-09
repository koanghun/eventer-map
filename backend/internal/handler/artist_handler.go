package handler

import (
	"io"
	"log"
	"net/http"
	"strings"

	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/repository"
	"eventer-map-backend/internal/service"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func mapArtistToResponse(a *repository.Artist) Artist {
	id := openapi_types.UUID(a.ID)
	name := a.OfficialName
	gen := ArtistGender(a.Gender)
	st := ArtistStatus(a.Status)
	var hiragana *string
	if a.Hiragana.Valid && a.Hiragana.String != "" {
		h := a.Hiragana.String
		hiragana = &h
	}
	var disambiguation *string
	if a.Disambiguation.Valid && a.Disambiguation.String != "" {
		d := a.Disambiguation.String
		disambiguation = &d
	}
	var profileImageURL *string
	if a.ProfileImageUrl.Valid && a.ProfileImageUrl.String != "" {
		p := a.ProfileImageUrl.String
		profileImageURL = &p
	}
	var authorID *openapi_types.UUID
	if a.AuthorID.Valid {
		aID := openapi_types.UUID(a.AuthorID.UUID)
		authorID = &aID
	}

	return Artist{
		Id:              &id,
		OfficialName:    &name,
		Hiragana:        hiragana,
		Disambiguation:  disambiguation,
		Gender:          &gen,
		ProfileImageUrl: profileImageURL,
		Status:          &st,
		AuthorId:        authorID,
	}
}

// GetArtists implements the GET /artists endpoint
func (s *Server) GetArtists(w http.ResponseWriter, r *http.Request, params GetArtistsParams) {
	limit := service.DefaultArtistLimit
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	status := ""
	if params.Status != nil {
		status = string(*params.Status)
	}
	nameKeyword := ""
	if params.Query != nil {
		nameKeyword = *params.Query
	}

	cursor := uuid.Nil

	artists, err := s.services.Artist.ListArtists(r.Context(), limit, status, nameKeyword, cursor)
	if err != nil {
		log.Printf("[GetArtists] ListArtists error: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve artists")
		return
	}

	summaries := make([]ArtistSummary, 0, len(artists))
	for _, a := range artists {
		id := openapi_types.UUID(a.ID)
		name := a.OfficialName
		st := ArtistSummaryStatus(a.Status)
		var hiragana *string
		if a.Hiragana.Valid && a.Hiragana.String != "" {
			h := a.Hiragana.String
			hiragana = &h
		}
		var disambiguation *string
		if a.Disambiguation.Valid && a.Disambiguation.String != "" {
			d := a.Disambiguation.String
			disambiguation = &d
		}
		summaries = append(summaries, ArtistSummary{
			Id:             &id,
			OfficialName:   &name,
			Hiragana:       hiragana,
			Disambiguation: disambiguation,
			Status:         &st,
		})
	}

	RespondJSON(w, http.StatusOK, summaries)
}

// PostArtists implements the POST /artists endpoint
func (s *Server) PostArtists(w http.ResponseWriter, r *http.Request) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	if err := r.ParseMultipartForm(5 << 20); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid form data")
		return
	}

	officialName := strings.TrimSpace(r.FormValue("officialName"))
	gender := ArtistInputGender(strings.TrimSpace(r.FormValue("gender")))
	if officialName == "" || !gender.Valid() {
		RespondError(w, http.StatusBadRequest, "officialName and valid gender (MALE, FEMALE) are required")
		return
	}

	input := service.CreateArtistInput{
		OfficialName: officialName,
		Gender:       string(gender),
		AuthorID:     myID,
	}

	if file, header, err := r.FormFile("profileImage"); err == nil {
		defer file.Close()
		if header.Size > 5<<20 {
			RespondError(w, http.StatusBadRequest, "profileImage must be 5MB or smaller")
			return
		}

		// Inspect magic bytes (up to 512 bytes) to verify actual image format
		var sniffBuf [512]byte
		n, readErr := io.ReadFull(file, sniffBuf[:])
		if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
			RespondError(w, http.StatusBadRequest, "Failed to read profileImage")
			return
		}
		detectedType := http.DetectContentType(sniffBuf[:n])
		if detectedType != "image/jpeg" && detectedType != "image/png" {
			RespondError(w, http.StatusBadRequest, "profileImage must be a valid JPG or PNG image")
			return
		}
		if _, seekErr := file.Seek(0, io.SeekStart); seekErr != nil {
			RespondError(w, http.StatusInternalServerError, "Failed to process profileImage")
			return
		}

		input.ProfileImage = file
		input.ProfileImageContentType = detectedType
	} else if err != http.ErrMissingFile {
		RespondError(w, http.StatusBadRequest, "Invalid profileImage upload")
		return
	}

	if h := strings.TrimSpace(r.FormValue("hiragana")); h != "" {
		input.Hiragana = &h
	}
	if d := strings.TrimSpace(r.FormValue("disambiguation")); d != "" {
		if len([]rune(d)) > 100 {
			RespondError(w, http.StatusBadRequest, "disambiguation must be 100 characters or fewer")
			return
		}
		input.Disambiguation = &d
	}

	created, err := s.services.Artist.CreateArtist(r.Context(), input)
	if err != nil {
		log.Printf("[PostArtists] CreateArtist error (officialName=%q, authorID=%s): %v", input.OfficialName, input.AuthorID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to create artist")
		return
	}

	RespondJSON(w, http.StatusCreated, mapArtistToResponse(created))
}

// GetArtistsArtistId implements the GET /artists/{artistId} endpoint
func (s *Server) GetArtistsArtistId(w http.ResponseWriter, r *http.Request, artistId uuid.UUID) {
	artist, err := s.services.Artist.GetArtist(r.Context(), artistId)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Artist not found")
		return
	}

	RespondJSON(w, http.StatusOK, mapArtistToResponse(artist))
}

// PostArtistsArtistIdFollow implements the POST /artists/{artistId}/follow endpoint
func (s *Server) PostArtistsArtistIdFollow(w http.ResponseWriter, r *http.Request, artistId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.Artist.FollowArtist(r.Context(), myID, artistId); err != nil {
		log.Printf("[PostArtistsArtistIdFollow] FollowArtist error (userID=%s, artistID=%s): %v", myID, artistId, err)
		RespondError(w, http.StatusInternalServerError, "Failed to follow artist")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Followed successfully"})
}

// DeleteArtistsArtistIdFollow implements the DELETE /artists/{artistId}/follow endpoint
func (s *Server) DeleteArtistsArtistIdFollow(w http.ResponseWriter, r *http.Request, artistId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}
	if err := s.services.Artist.UnfollowArtist(r.Context(), myID, artistId); err != nil {
		log.Printf("[DeleteArtistsArtistIdFollow] UnfollowArtist error (userID=%s, artistID=%s): %v", myID, artistId, err)
		RespondError(w, http.StatusInternalServerError, "Failed to unfollow artist")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]string{"message": "Unfollowed successfully"})
}

// GetArtistsArtistIdFollowers implements the GET /artists/{artistId}/followers endpoint
func (s *Server) GetArtistsArtistIdFollowers(w http.ResponseWriter, r *http.Request, artistId uuid.UUID, params GetArtistsArtistIdFollowersParams) {
	limit := int32(20)
	if params.Limit != nil {
		limit = int32(*params.Limit)
	}
	offset := int32(0)
	if params.Offset != nil {
		offset = int32(*params.Offset)
	}

	followers, err := s.services.Artist.ListArtistFollowers(r.Context(), artistId, limit, offset)
	if err != nil {
		log.Printf("[GetArtistsArtistIdFollowers] ListArtistFollowers error (artistID=%s): %v", artistId, err)
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

// PostArtistsArtistIdRate implements the POST /artists/{artistId}/rate endpoint
func (s *Server) PostArtistsArtistIdRate(w http.ResponseWriter, r *http.Request, artistId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var reqBody struct {
		Score int32 `json:"score"`
	}
	if err := ParseJSON(r, &reqBody); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if reqBody.Score != 1 && reqBody.Score != -1 {
		RespondError(w, http.StatusBadRequest, "score must be 1 or -1")
		return
	}

	updatedArtist, err := s.services.Artist.RateArtist(r.Context(), myID, artistId, reqBody.Score)
	if err != nil {
		log.Printf("[PostArtistsArtistIdRate] RateArtist error (userID=%s, artistID=%s): %v", myID, artistId, err)
		RespondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	RespondJSON(w, http.StatusOK, mapArtistToResponse(updatedArtist))
}
