package middleware

import (
	"net/http"
	"os"
	"strings"
)

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedOrigin := "http://localhost:3000"

		corsOrigins := os.Getenv("CORS_ORIGINS")
		if corsOrigins != "" && origin != "" {
			for _, o := range strings.Split(corsOrigins, ",") {
				trimmed := strings.TrimSpace(o)
				if trimmed == "*" || trimmed == origin {
					allowedOrigin = origin
					break
				}
			}
		}
		if allowedOrigin != origin && origin != "" {
			if origin == "http://localhost:3000" ||
				origin == "http://127.0.0.1:3000" ||
				(os.Getenv("ENV") == "local" && (strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:"))) {
				allowedOrigin = origin
			}
		}

		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
