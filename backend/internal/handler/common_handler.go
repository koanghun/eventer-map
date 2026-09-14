package handler

import (
	"net/http"
)

// GetPing implements the /ping API for health checks.
func (s *Server) GetPing(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusOK, map[string]string{"message": "pong from handler"})
}

// PostVisits increments the daily visit counter and returns the current count.
func (s *Server) PostVisits(w http.ResponseWriter, r *http.Request) {
	count, err := s.services.Stats.IncrementDailyVisit(r.Context())
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Failed to increment visit counter")
		return
	}
	RespondJSON(w, http.StatusOK, map[string]int32{"count": count})
}

// GetVisits returns today's visit count without incrementing.
func (s *Server) GetVisits(w http.ResponseWriter, r *http.Request) {
	count, err := s.services.Stats.GetDailyVisit(r.Context())
	if err != nil {
		// If not found (no visits yet today), it might return sql.ErrNoRows.
		// In that case, count should be 0.
		count = 0
	}
	RespondJSON(w, http.StatusOK, map[string]int32{"count": count})
}
