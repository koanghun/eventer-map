const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    // [개발 환경 설정 / Development Config]
    // 이 설정은 'npm start' (react-scripts start)로 실행되는 개발 서버에서만 동작합니다.
    // 프로덕션 빌드(npm run build) 후 Nginx 등으로 배포할 때는 이 파일이 사용되지 않습니다.
    // 프로덕션에서는 Nginx의 location /api 블록을 통해 리버스 프록시를 설정해야 합니다.

    app.use(
        '/api',
        createProxyMiddleware({
            // 1. 도커 네트워크 내부의 백엔드 서비스 이름 (docker-compose service name)
            // 예: http://backend:8000 또는 http://server:8000
            // 만약 로컬에서 백엔드를 띄웠다면 http://localhost:8000
            target: 'http://backend:8000',

            changeOrigin: true,

            // 2. 디버깅 로그 레벨
            logLevel: 'debug',
        })
    );
};
