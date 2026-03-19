const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    // [개발 환경 설정 / Development Config]
    // 이 설정은 'npm start' (react-scripts start)로 실행되는 개발 서버에서만 동작합니다.
    // 프로덕션 빌드(npm run build) 후 Nginx 등으로 배포할 때는 이 파일이 사용되지 않습니다.
    // 프로덕션에서는 Nginx의 location /api 블록을 통해 리버스 프록시를 설정해야 합니다.

    app.use(
        '/api',
        createProxyMiddleware({
            // 1. API 주소를 환경변수(REACT_APP_API_URL)에서 가져오거나 (기본값 localhost)
            target: process.env.REACT_APP_API_URL || 'http://localhost:8000',

            changeOrigin: true,

            // /api 제거하여 백엔드로 전달
            // 예: /api/events → /events
            pathRewrite: {
                '^/api': ''
            },

            // 2. 디버깅 로그 레벨
            logLevel: 'debug',
        })
    );
};
