package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
)

func main() {
	// 1. 표준 http.ServeMux 라우터 생성
	mux := http.NewServeMux()
	
	// TODO: oapi-codegen으로 생성된 핸들러를 mux에 등록
	// handler.HandlerFromMux(myServerImpl, mux)

	mux.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"message":"pong"}`)
	})

	// 2. AWS Lambda 프록시 어댑터로 감싸기
	adapter := httpadapter.New(mux)

	// 3. Lambda 핸들러 시작
	lambda.Start(func(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
		// API Gateway를 통한 요청이 들어올 때 실행됨
		return adapter.ProxyWithContext(ctx, req)
	})
}
