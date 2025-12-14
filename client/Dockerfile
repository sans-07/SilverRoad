# Step 1: 빌드하기 (Node.js 환경)
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# 여기서 빌드 명령어 실행! (dist 폴더가 생성됨)
RUN npm run build
# Step 2: 실행하기 (Nginx 웹 서버 환경)
FROM nginx:alpine
# 빌드된 결과물(dist)만 쏙 빼서 Nginx 폴더로 옮깁니다.
COPY --from=builder /app/dist /usr/share/nginx/html
# 우리가 만든 설정파일을 적용합니다.
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]