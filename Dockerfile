# 1. Node.js 18 버전 환경을 가져옵니다.
FROM node:18
# 2. 도커 안에서 코드가 들어갈 폴더를 정합니다.
WORKDIR /app
# 3. 의존성 파일들을 먼저 복사하고 설치합니다 (속도 최적화).
COPY package*.json ./
RUN npm install
# 4. 나머지 모든 소스 코드를 복사합니다.
COPY . .
# 5. 서버가 사용하는 3000번 포트를 열어둔다고 명시합니다.
EXPOSE 3000
# 6. 컨테이너가 시작될 때 실행할 명령어를 입력합니다.
CMD ["npm", "start"]