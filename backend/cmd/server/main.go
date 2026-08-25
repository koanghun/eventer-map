package main

import (
	"context"
	"database/sql"
	"net/http"

	"eventer-map-backend/internal/handler"
	"eventer-map-backend/internal/middleware"
	"eventer-map-backend/internal/repository"
	"eventer-map-backend/internal/service"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

func main() {
	// 1. DB Connection (Dummy for now until we configure DSN)
	// db, err := sql.Open("postgres", "postgres://user:pass@localhost:5432/db?sslmode=disable")
	// if err != nil { log.Fatal(err) }
	var db *sql.DB

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

	// 7. Wrap with Middlewares (e.g., Logger)
	var h http.Handler = mux
	h = middleware.Logger(h)

	// 8. Start AWS Lambda Proxy
	adapter := httpadapter.New(h)
	lambda.Start(func(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
		return adapter.ProxyWithContext(ctx, req)
	})
}
