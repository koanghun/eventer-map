package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/service"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

var eventDateLocation = time.FixedZone("UTC+9", 9*60*60)

func mapEventDetailToResponse(detail *service.EventDetail) Event {
	e := detail.Event
	id := openapi_types.UUID(e.ID)
	title := e.Title
	startTime := e.StartTime
	endTime := e.EndTime
	ratingSum := e.RatingSum
	ratingCount := int(e.RatingCount)
	attendeeCount := int(detail.AttendeeCount)
	status := EventStatus(e.Status)

	var openingTime *time.Time
	if e.OpeningTime.Valid {
		t := e.OpeningTime.Time
		openingTime = &t
	}

	var posterURL *string
	if e.PosterImageUrl.Valid && e.PosterImageUrl.String != "" {
		p := e.PosterImageUrl.String
		posterURL = &p
	}

	relatedLinks := make([]string, 0)
	if len(e.RelatedLinks) > 0 {
		relatedLinks = e.RelatedLinks
	}

	var venueSummary *VenueSummary
	if detail.Venue != nil {
		v := detail.Venue
		vID := openapi_types.UUID(v.ID)
		vName := v.OfficialName
		vAddr := v.Address
		vLat := v.Latitude
		vLng := v.Longitude
		vStatus := VenueSummaryStatus(v.Status)
		var vRating *float64
		if v.RatingCount > 0 {
			avg := v.RatingSum / float64(v.RatingCount)
			vRating = &avg
		}
		venueSummary = &VenueSummary{
			Id:           &vID,
			OfficialName: &vName,
			Address:      &vAddr,
			Latitude:     &vLat,
			Longitude:    &vLng,
			Rating:       vRating,
			Status:       &vStatus,
		}
	}

	artistSummaries := make([]ArtistSummary, 0, len(detail.Artists))
	for _, a := range detail.Artists {
		aID := openapi_types.UUID(a.ID)
		aName := a.OfficialName
		aStatus := ArtistSummaryStatus(a.Status)
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
		var aRating *float64
		if a.RatingCount > 0 {
			avg := a.RatingSum / float64(a.RatingCount)
			aRating = &avg
		}
		artistSummaries = append(artistSummaries, ArtistSummary{
			Id:             &aID,
			OfficialName:   &aName,
			Hiragana:       hiragana,
			Disambiguation: disambiguation,
			Rating:         aRating,
			Status:         &aStatus,
		})
	}

	return Event{
		Id:             &id,
		Title:          &title,
		Venue:          venueSummary,
		Artists:        &artistSummaries,
		OpeningTime:    openingTime,
		StartTime:      &startTime,
		EndTime:        &endTime,
		RelatedLinks:   &relatedLinks,
		PosterImageUrl: posterURL,
		RatingSum:      &ratingSum,
		RatingCount:    &ratingCount,
		AttendeeCount:  &attendeeCount,
		Status:         &status,
	}
}

// GetEvents implements the GET /events endpoint
func (s *Server) GetEvents(w http.ResponseWriter, r *http.Request, params GetEventsParams) {
	filter := service.ListEventsFilter{
		MinLat:   params.MinLat,
		MaxLat:   params.MaxLat,
		MinLng:   params.MinLng,
		MaxLng:   params.MaxLng,
		Limit:    service.DefaultEventLimit,
		VenueID:  params.VenueId,
		ArtistID: params.ArtistId,
	}

	if params.Limit != nil {
		filter.Limit = int32(*params.Limit)
	}

	if params.Status != nil {
		statusStr := string(*params.Status)
		filter.Status = &statusStr
	}

	if params.StartDate != nil {
		d := params.StartDate.Time
		startFrom := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, eventDateLocation)
		filter.StartTimeFrom = &startFrom
	}

	if params.EndDate != nil {
		d := params.EndDate.Time
		endTo := time.Date(d.Year(), d.Month(), d.Day(), 23, 59, 59, 999999999, eventDateLocation)
		filter.StartTimeTo = &endTo
	}

	if params.TimeRange != nil {
		now := time.Now().UTC()
		switch *params.TimeRange {
		case Upcoming:
			if filter.StartTimeFrom == nil {
				filter.StartTimeFrom = &now
			}
		case Past:
			if filter.StartTimeTo == nil {
				filter.StartTimeTo = &now
			}
		}
	}

	rows, hasMore, err := s.services.Event.ListEvents(r.Context(), filter)
	if err != nil {
		log.Printf("[GetEvents] ListEvents error: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve events")
		return
	}

	summaries := make([]EventSummary, 0, len(rows))
	for _, row := range rows {
		id := openapi_types.UUID(row.ID)
		title := row.Title
		startTime := row.StartTime
		endTime := row.EndTime
		attendeeCount := int(row.AttendeeCount)
		status := EventSummaryStatus(row.Status)

		var venueID *openapi_types.UUID
		if row.VenueID.Valid {
			vID := openapi_types.UUID(row.VenueID.UUID)
			venueID = &vID
		}

		var venueName *string
		if row.VenueName != "" {
			vName := row.VenueName
			venueName = &vName
		}

		var lat, lng *float64
		if row.VenueID.Valid {
			l1 := row.Latitude
			l2 := row.Longitude
			lat = &l1
			lng = &l2
		}

		var rating *float64
		if row.RatingCount > 0 {
			avg := row.RatingSum / float64(row.RatingCount)
			rating = &avg
		}

		var posterURL *string
		if row.PosterImageUrl.Valid && row.PosterImageUrl.String != "" {
			p := row.PosterImageUrl.String
			posterURL = &p
		}

		var topArtistName *string
		if row.TopArtistName != "" {
			n := row.TopArtistName
			topArtistName = &n
		}

		var topArtistProfileImageURL *string
		if row.TopArtistProfileImageUrl != "" {
			u := row.TopArtistProfileImageUrl
			topArtistProfileImageURL = &u
		}

		summaries = append(summaries, EventSummary{
			Id:                       &id,
			Title:                    &title,
			VenueId:                  venueID,
			VenueName:                venueName,
			Latitude:                 lat,
			Longitude:                lng,
			StartTime:                &startTime,
			EndTime:                  &endTime,
			Rating:                   rating,
			AttendeeCount:            &attendeeCount,
			PosterImageUrl:           posterURL,
			TopArtistName:            topArtistName,
			TopArtistProfileImageUrl: topArtistProfileImageURL,
			Status:                   &status,
		})
	}

	RespondJSON(w, http.StatusOK, EventListResponse{
		Events:  &summaries,
		HasMore: &hasMore,
	})
}

// GetEventsEventId implements the GET /events/{eventId} endpoint
func (s *Server) GetEventsEventId(w http.ResponseWriter, r *http.Request, eventId uuid.UUID) {
	detail, err := s.services.Event.GetEventDetail(r.Context(), eventId)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Event not found")
		return
	}

	RespondJSON(w, http.StatusOK, mapEventDetailToResponse(detail))
}

func parseEventMultipartInput(r *http.Request, authorID uuid.UUID) (service.CreateEventInput, string) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		return service.CreateEventInput{}, "Invalid form data"
	}

	title := strings.TrimSpace(r.FormValue("title"))
	if title == "" {
		return service.CreateEventInput{}, "title is required"
	}

	venueIDStr := strings.TrimSpace(r.FormValue("venueId"))
	venueID, err := uuid.Parse(venueIDStr)
	if err != nil || venueID == uuid.Nil {
		return service.CreateEventInput{}, "valid venueId is required"
	}

	startTimeStr := strings.TrimSpace(r.FormValue("startTime"))
	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		return service.CreateEventInput{}, "valid startTime is required"
	}

	endTimeStr := strings.TrimSpace(r.FormValue("endTime"))
	endTime, err := time.Parse(time.RFC3339, endTimeStr)
	if err != nil {
		return service.CreateEventInput{}, "valid endTime is required"
	}

	if endTime.Before(startTime) {
		endTime = endTime.Add(24 * time.Hour)
	}

	var openingTime *time.Time
	if openingTimeStr := strings.TrimSpace(r.FormValue("openingTime")); openingTimeStr != "" {
		t, err := time.Parse(time.RFC3339, openingTimeStr)
		if err != nil {
			return service.CreateEventInput{}, "invalid openingTime"
		}
		openingTime = &t
	}

	var artistIDs []uuid.UUID
	if r.MultipartForm != nil {
		for _, rawID := range r.MultipartForm.Value["artistIds"] {
			trimmed := strings.TrimSpace(rawID)
			if trimmed == "" {
				continue
			}
			parsedID, err := uuid.Parse(trimmed)
			if err != nil {
				return service.CreateEventInput{}, "invalid artistIds"
			}
			artistIDs = append(artistIDs, parsedID)
		}
	}

	var relatedLinks []string
	if r.MultipartForm != nil {
		for _, rawLink := range r.MultipartForm.Value["relatedLinks"] {
			if trimmed := strings.TrimSpace(rawLink); trimmed != "" {
				relatedLinks = append(relatedLinks, trimmed)
			}
		}
	}

	return service.CreateEventInput{
		Title:        title,
		VenueID:      venueID,
		ArtistIDs:    artistIDs,
		OpeningTime:  openingTime,
		StartTime:    startTime,
		EndTime:      endTime,
		RelatedLinks: relatedLinks,
		AuthorID:     authorID,
	}, ""
}

// PostEvents implements the POST /events endpoint
func (s *Server) PostEvents(w http.ResponseWriter, r *http.Request) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	input, validationErr := parseEventMultipartInput(r, myID)
	if validationErr != "" {
		RespondError(w, http.StatusBadRequest, validationErr)
		return
	}

	detail, err := s.services.Event.CreateEvent(r.Context(), input)
	if err != nil {
		if errors.Is(err, service.ErrUserBanned) {
			RespondError(w, http.StatusForbidden, "User is banned")
			return
		}
		log.Printf("[PostEvents] CreateEvent error (title=%q, venueID=%s, authorID=%s): %v", input.Title, input.VenueID, input.AuthorID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to create event")
		return
	}

	RespondJSON(w, http.StatusCreated, mapEventDetailToResponse(detail))
}

// PutEventsEventId implements the PUT /events/{eventId} endpoint
func (s *Server) PutEventsEventId(w http.ResponseWriter, r *http.Request, eventId uuid.UUID) {
	myID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	input, validationErr := parseEventMultipartInput(r, myID)
	if validationErr != "" {
		RespondError(w, http.StatusBadRequest, validationErr)
		return
	}

	detail, err := s.services.Event.UpdateEvent(r.Context(), eventId, input)
	if err != nil {
		if errors.Is(err, service.ErrUserBanned) {
			RespondError(w, http.StatusForbidden, "User is banned")
			return
		}
		log.Printf("[PutEventsEventId] UpdateEvent error (eventID=%s, authorID=%s): %v", eventId, input.AuthorID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to update event")
		return
	}

	RespondJSON(w, http.StatusOK, mapEventDetailToResponse(detail))
}

// PostEventsEventIdRate implements the POST /events/{eventId}/rate endpoint
func (s *Server) PostEventsEventIdRate(w http.ResponseWriter, r *http.Request, eventId uuid.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var reqBody RatingInput
	if err := ParseJSON(r, &reqBody); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := s.services.Event.RateEvent(r.Context(), eventId, userID, int32(reqBody.Score)); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidScore), errors.Is(err, service.ErrEventNotEnded):
			RespondError(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrNotAttendee):
			RespondError(w, http.StatusForbidden, err.Error())
		default:
			log.Printf("[PostEventsEventIdRate] RateEvent error (userID=%s, eventID=%s): %v", userID, eventId, err)
			RespondError(w, http.StatusInternalServerError, "Failed to rate event")
		}
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Rating submitted"})
}

// PutEventsEventIdAction implements the PUT /events/{eventId}/action endpoint
func (s *Server) PutEventsEventIdAction(w http.ResponseWriter, r *http.Request, eventId uuid.UUID) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	if !ok {
		RespondError(w, http.StatusUnauthorized, "user not authenticated")
		return
	}

	var reqBody PutEventsEventIdActionJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err := s.services.Event.PutEventAction(r.Context(), userID, eventId, int32(reqBody.Status))
	if err != nil {
		log.Printf("[PutEventsEventIdAction] PutEventAction error (userID=%s, eventID=%s): %v", userID, eventId, err)
		RespondError(w, http.StatusInternalServerError, "Failed to update action")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Action updated"})
}

// GetEventsEventIdAttendees implements the GET /events/{eventId}/attendees endpoint
func (s *Server) GetEventsEventIdAttendees(w http.ResponseWriter, r *http.Request, eventId uuid.UUID, params GetEventsEventIdAttendeesParams) {
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

	attendees, err := s.services.Event.GetEventAttendees(r.Context(), myID, eventId, limit, offset)
	if err != nil {
		log.Printf("[GetEventsEventIdAttendees] GetEventAttendees error (eventID=%s): %v", eventId, err)
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve attendees")
		return
	}

	response := make([]UserProfile, 0)
	for _, a := range attendees {
		id := openapi_types.UUID(a.ID)
		name := a.DisplayName
		t := a.CreatedAt
		response = append(response, UserProfile{
			Id:          &id,
			DisplayName: &name,
			CreatedAt:   &t,
		})
	}
	RespondJSON(w, http.StatusOK, response)
}
