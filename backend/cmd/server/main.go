package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"eventer-map-backend/internal/handler"
	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/repository"
	"eventer-map-backend/internal/service"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

func main() {
	// 0. Load .env file for local development
	_ = godotenv.Load()

	// 1. DB Connection
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("WARNING: DATABASE_URL is not set. API will fail on DB queries.")
	}

	var db *sql.DB
	if dbURL != "" {
		var err error
		db, err = sql.Open("postgres", dbURL)
		if err != nil {
			log.Fatalf("Failed to open DB: %v", err)
		}
		if err = db.Ping(); err != nil {
			log.Fatalf("Failed to ping DB: %v", err)
		}
		log.Println("Successfully connected to the database!")
	}

	// 2. Initialize Repository
	repo := repository.New(db)

	// 3. Initialize Services
	services := service.NewServices(repo)

	// 4. Initialize Handler (implements ServerInterface)
	apiHandler := handler.NewServer(services)

	// 5. Setup Router (ServeMux)
	mux := http.NewServeMux()
	
	// 6. Register oapi-codegen Handlers
	handler.HandlerFromMux(apiHandler, mux)

	// 7. Wrap with Middlewares
	var h http.Handler = mux
	h = middleware.CORS(h)
	h = middleware.Logger(h)

	// 8. Start Server (Local vs Lambda)
	if os.Getenv("ENV") == "local" {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		log.Printf("Starting local development server on port %s...", port)
		log.Fatal(http.ListenAndServe(":"+port, h))
	} else {
		// Start AWS Lambda Proxy
		adapter := httpadapter.New(h)
		lambda.Start(func(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
			return adapter.ProxyWithContext(ctx, req)
		})
	}
}
