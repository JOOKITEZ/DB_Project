# 📋 조별과제 매니저

조별과제 운영을 편리하게 돕고, **열심히 참여한 사람과 그렇지 않은 사람을 지분(%)으로 가시화**하는 웹 서비스입니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 회원가입 / 로그인 | id, 비밀번호(6자 이상 + 영문/숫자/특수기호, bcrypt 해시 저장), 닉네임, 이메일. JWT 인증 |
| 프로젝트 생성 | 생성자가 자동으로 **팀장**이 되고, 고유 **4자리 초대 코드**가 부여됨 |
| 초대 코드 참가 | 4자리 코드를 입력해 팀원으로 참가 |
| 역할 부여 | 팀장이 각 팀원에게 역할을 지정 (예: 자료조사, PPT 제작) |
| 할 일 관리 | 팀장·팀원 누구나 추가 가능. 담당자·**종류(category)**·**순서(order)**·**최대 기한(dueDate)** 을 설정 |
| 작업 권한 | 자료 등록·PPT 업로드·대본 작성은 **해당 종류의 할 일을 배정받은 사람만** 가능 |
| 작업 바로가기 | 할 일을 클릭하면 그 종류의 작업 화면(자료조사/PPT 탭)으로 자동 이동 |
| 마감 알림 | 기한 **이틀 전 / 하루 전** 두 번 알림 (스케줄러가 매시 검사) |
| 지분 차감 | 기한을 넘기면 해당 팀원의 점수 −10 → 지분 하락. 기한 내 완료 시 +10 |
| 순서 알림 | 한 일정이 완료되면 **다음 순서 담당자에게 즉시 알림** |
| 자료조사 모음 | 기사 / 논문 / 영상링크를 종류별로 모아보기 |
| PPT 보관함 | ppt·pptx·pdf 업로드, **장(슬라이드)별로 그 아래에 대본** 작성 |
| 메시지 | 프로젝트별 채팅 (3초 폴링) |
| 지분 현황 | 팀장·팀원 모두의 지분을 점수 비율(%)과 막대그래프로 표시 |

## 기술 스택

- **Backend**: Node.js, Express
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: JWT + bcryptjs
- **Scheduler**: node-cron (마감 알림 / 지분 차감)
- **File Upload**: multer
- **Frontend**: HTML / CSS / Vanilla JS (SPA)

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

```env
# 로컬 MongoDB 사용 시
MONGODB_URI=mongodb://localhost:27017/team_project_db

# MongoDB Atlas(클라우드) 사용 시
# MONGODB_URI=mongodb+srv://<유저>:<비밀번호>@<클러스터>.mongodb.net/team_project_db

JWT_SECRET=아무도-모르는-비밀키
PORT=3000
```

> MongoDB Atlas 무료 클러스터: https://www.mongodb.com/cloud/atlas 에서 생성 후 연결 문자열을 복사하면 됩니다.

### 3. 서버 실행

```bash
npm start        # 또는 개발 모드: npm run dev
```

브라우저에서 http://localhost:3000 접속.

### 4. (선택) 스모크 테스트

인메모리 MongoDB로 회원가입 → 프로젝트 생성 → 초대 → 할 일 → 알림 → 지분 차감까지 전체 흐름을 검증합니다.

```bash
npm test
```

## DB 컬렉션 구조 (MongoDB)

| 컬렉션 | 주요 필드 |
|---|---|
| `users` | userId, password(해시), nickname, email |
| `projects` | name, inviteCode(4자리, unique), leader, members[{user, role, isLeader, score}] |
| `tasks` | project, assignee, title, category(기사/논문/영상/PPT/대본/기타), order, dueDate, status, notifiedTwoDays, notifiedOneDay, penaltyApplied |
| `resources` | project, uploader, type(기사/논문/영상), title, url, memo |
| `ppts` | project, uploader, originalName, fileName, scripts[{slideNumber, script}] |
| `messages` | project, sender, content |
| `notifications` | user, project, type(마감임박/기한초과/다음순서), message, read |

## 작업 권한 규칙

모든 작업은 **할 일에 추가되어야 권한이 생깁니다.**

| 하려는 작업 | 필요한 할 일 종류 |
|---|---|
| 기사 자료 등록 | `기사` |
| 논문 자료 등록 | `논문` |
| 영상 자료 등록 | `영상` |
| PPT 업로드 | `PPT` |
| 슬라이드 대본 작성 | `대본` |

해당 종류의 할 일을 배정받지 않은 사람이 작업을 시도하면 403 오류와 함께 안내 메시지가 표시됩니다.

## 지분 계산 방식

- 모든 멤버는 **기본 100점**으로 시작합니다.
- 할 일을 **기한 내 완료**하면 **+10점**, **기한 초과** 시 **−10점**.
- 가산점을 받은 할 일을 **삭제하거나 완료를 취소하면 +10점도 회수**됩니다.
- 지분(%) = 내 점수 ÷ 팀 전체 점수 합 × 100

## API 요약

```
POST   /api/auth/signup                      회원가입
POST   /api/auth/login                       로그인
GET    /api/projects                         내 프로젝트 목록
POST   /api/projects                         프로젝트 생성 (초대코드 자동 부여)
POST   /api/projects/join                    초대 코드로 참가
GET    /api/projects/:id                     프로젝트 상세
PUT    /api/projects/:id/members/:uid/role   역할 부여 (팀장)
GET    /api/projects/:id/shares              지분 조회
POST   /api/projects/:id/tasks               할 일 생성 (팀장)
GET    /api/projects/:id/tasks               할 일 목록
PUT    /api/projects/:id/tasks/:tid/status   상태 변경 (완료 시 다음 순서 알림)
POST   /api/projects/:id/resources           자료 등록
GET    /api/projects/:id/resources           자료 목록 (?type=기사|논문|영상)
POST   /api/projects/:id/ppts                PPT 업로드
PUT    /api/projects/:id/ppts/:pid/scripts   장별 대본 저장
POST   /api/projects/:id/messages            메시지 전송
GET    /api/projects/:id/messages            메시지 목록 (?after= 폴링)
GET    /api/notifications                    내 알림
PUT    /api/notifications/read-all           모두 읽음
```
