package middleware

import (
	"log"
	"net/http"
	"runtime/debug"
	"time"
)

// Logger is a simple middleware that logs the HTTP method, path, and duration of each request
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("[PANIC] %s %s recovered: %v\n%s", r.Method, r.URL.Path, rec, string(debug.Stack()))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"error":"Internal server error"}`))
			}
			log.Printf("[HTTP] %s %s took %v", r.Method, r.URL.Path, time.Since(start))
		}()
		next.ServeHTTP(w, r)
	})
}
