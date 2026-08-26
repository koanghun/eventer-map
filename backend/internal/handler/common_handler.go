package handler

import (
	"net/http"
)

// GetPing implements the /ping API for health checks.
func (s *Server) GetPing(w http.ResponseWriter, r *http.Request) {
	RespondJSON(w, http.StatusOK, map[string]string{"message": "pong from handler"})
}
