# Go 표준 라이브러리 가이드북 (Eventer Map 백엔드용)

Go 언어는 `Express.js`, `Spring` 같은 무거운 외부 프레임워크 없이도, 언어 자체에 내장된 **표준 라이브러리(Standard Library)**만으로 강력한 백엔드 서버를 만들 수 있습니다. 

우리 프로젝트에서 사용 중인 핵심 표준 라이브러리들의 개념과 사용법을 알기 쉽게 정리했습니다.

---

## 1. `net/http` (웹 서버의 심장)

Go에서 HTTP 통신(요청 받기, 응답 보내기, 라우팅)을 담당하는 가장 중요한 패키지입니다.

### 📍 `http.ResponseWriter` 와 `*http.Request`
모든 API 핸들러 함수는 항상 이 두 가지를 매개변수로 받습니다.
- `r *http.Request`: **클라이언트(프론트엔드)가 보낸 편지**입니다. 어떤 URL로 왔는지, 바디(JSON) 데이터는 무엇인지, 헤더는 어떤지 들어있습니다.
- `w http.ResponseWriter`: **클라이언트에게 보낼 답장 봉투**입니다. 여기에 글씨(JSON 등)를 쓰거나 상태 코드(200, 404 등)를 세팅하면 그대로 사용자에게 전송됩니다.

```go
// 예시: 간단한 핸들러
func pingHandler(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(200) // 상태 코드 200 OK 세팅
    w.Write([]byte("pong")) // 화면에 "pong" 출력
}
```

### 📍 `http.ServeMux` (라우터 / MUX)
- `Mux`는 Multiplexer의 약자로, **교통 경찰(라우터)** 역할을 합니다.
- "`/ping`으로 요청이 오면 `pingHandler`로 보내!", "`/users`로 오면 `userHandler`로 보내!" 라고 길을 안내해 주는 객체입니다.
- 우리 코드의 `mux := http.NewServeMux()` 가 바로 이 교통 경찰을 고용하는 코드입니다.

### 📍 `http.Handler` (인터페이스)
Go 웹 생태계의 알파이자 오메가입니다. 
아래처럼 딱 하나의 함수(`ServeHTTP`)만 구현하면 무엇이든 `http.Handler`가 됩니다.
```go
type Handler interface {
    ServeHTTP(ResponseWriter, *Request)
}
```
`ServeMux` 자체도 `http.Handler`이며, 모든 미들웨어도 `http.Handler`를 받고 반환합니다. 블록 장난감처럼 끼워 맞추기(Wrapping)가 가능해집니다.

---

## 2. 미들웨어 (Middleware) 패턴

미들웨어는 양파 껍질처럼 핸들러를 겹겹이 감싸는 함수입니다. 요청이 진짜 목적지(비즈니스 핸들러)에 도달하기 전/후에 **로깅, 인증, 에러 복구** 등을 공통으로 처리할 때 씁니다.

```go
// 우리 프로젝트의 logger.go 예시
func Logger(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. 요청이 들어왔을 때 할 일 (시간 측정 시작)
        start := time.Now() 
        
        // 2. 알맹이(다음 핸들러) 실행!
        next.ServeHTTP(w, r) 
        
        // 3. 알맹이가 끝난 뒤 할 일 (걸린 시간 출력)
        log.Printf("걸린 시간: %v", time.Since(start))
    })
}
```
이걸 `main.go`에서 `middleware.Logger(mux)` 처럼 감싸면, 모든 API 요청이 무조건 이 Logger를 거쳐가게 됩니다.

---

## 3. `context` (맥락 / 수화물 표)

`context.Context`는 Go에서 비동기 처리나 긴 생명주기를 가진 요청을 다룰 때 쓰는 **수화물 표** 같은 객체입니다.

- **데이터 전달**: 미들웨어에서 해석한 유저 정보(예: JWT에서 뽑은 `user_id`)를 핸들러까지 몰래 전달하고 싶을 때 `context` 안에 쑤셔 넣어서(`WithValue`) 보냅니다.
- **타임아웃 & 취소**: 유저가 로딩을 못 참고 새로고침을 누르면(요청 취소), `context`가 "취소됐어!"라는 신호를 DB나 서비스 계층까지 쭉 전달해서 쓸데없는 연산을 멈추게 합니다.
- **규칙**: 거의 모든 DB 쿼리나 서비스 함수의 **첫 번째 매개변수**는 항상 `ctx context.Context`여야 합니다.

---

## 4. `database/sql`

Go에서 데이터베이스와 소통하는 표준 방법입니다.
- `sql.DB`: 데이터베이스 커넥션 **풀(Pool)**입니다. 하나의 연결이 아니라 수십 개의 연결을 묶어놓고 알아서 관리해 줍니다.
- 우리 코드에서는 `main.go`에서 한 번만 `db`를 생성한 뒤, 이 객체를 `repository`에 주입(Injection)하여 서버 전체가 하나의 DB 풀을 공유하도록 설계되어 있습니다.
