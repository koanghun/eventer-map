package handler

import (
	"encoding/json"
	"net/http"

	"eventer-map-backend/internal/middleware"
	"github.com/google/uuid"
)

// GetEvents implements the GET /events endpoint
func (s *Server) GetEvents(w http.ResponseWriter, r *http.Request, params GetEventsParams) {
	limit := int32(50)

	venueId := uuid.Nil
	if params.VenueId != nil {
		venueId = *params.VenueId
	}

	events, err := s.services.Event.ListEvents(r.Context(), limit, venueId)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to retrieve events")
		return
	}

	RespondJSON(w, http.StatusOK, events)
}

// GetEventsEventId implements the GET /events/{eventId} endpoint
func (s *Server) GetEventsEventId(w http.ResponseWriter, r *http.Request, eventId uuid.UUID) {
	event, err := s.services.Event.GetEvent(r.Context(), eventId)
	if err != nil {
		RespondError(w, http.StatusNotFound, "Event not found")
		return
	}

	RespondJSON(w, http.StatusOK, event)
}

// PostEvents implements the POST /events endpoint
func (s *Server) PostEvents(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid form data")
		return
	}

	// Just a skeleton for now, extract title to prove it works
	title := r.FormValue("title")
	if title == "" {
		RespondError(w, http.StatusBadRequest, "title is required")
		return
	}

	RespondJSON(w, http.StatusCreated, map[string]string{"message": "Event created", "title": title})
}

// PostEventsEventIdRate implements the POST /events/{eventId}/rate endpoint
func (s *Server) PostEventsEventIdRate(w http.ResponseWriter, r *http.Request, eventId uuid.UUID) {
	// In a real scenario we extract userID from middleware ctx
	// userID := r.Context().Value(middleware.UserIDKey).(uuid.UUID)
	
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
		RespondError(w, http.StatusInternalServerError, "Failed to update action")
		return
	}

	RespondJSON(w, http.StatusOK, map[string]string{"message": "Action updated"})
}
