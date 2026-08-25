package middleware

import (
	"log"
	"net/http"
	"time"
)

// Logger is a simple middleware that logs the HTTP method, path, and duration of each request
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		// We can also wrap ResponseWriter to capture status code, but keeping it simple for now
		next.ServeHTTP(w, r)
		log.Printf("[HTTP] %s %s took %v", r.Method, r.URL.Path, time.Since(start))
	})
}
