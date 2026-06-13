# 🧩 조각 (JOGAK)

> 조별과제, 각자의 몫이 보이다

조별과제 운영을 편리하게 돕고, **열심히 참여한 사람과 그렇지 않은 사람을 지분(조각)으로 가시화**하는 웹 서비스입니다. "조각"은 **조**별과제의 **각**자 몫이라는 뜻입니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 회원가입 / 로그인 | id, 비밀번호(6자 이상 + 영문/숫자/특수기호, bcrypt 해시 저장), 닉네임, 이메일. JWT 인증 |
| 아이디/비밀번호 찾기 | 가입한 이메일로 **4자리 인증코드**를 받아 아이디를 확인하거나 비밀번호를 재설정 |
| 프로젝트 생성 | 생성자가 자동으로 **팀장**이 되고, 고유 **4자리 초대 코드**가 부여됨 |
| 프로젝트 삭제 | **팀장만** 삭제 가능. 할 일·자료·PPT·메시지·알림이 함께 정리됨 |
| 초대 코드 참가 | 4자리 코드를 입력해 팀원으로 참가 (프로젝트 화면에서 **복사 버튼**으로 코드 복사) |
| 역할 부여 | 팀장이 **팀장 자신 포함 모든 멤버**에게 역할을 지정 (예: 자료조사, PPT 제작) |
| 할 일 관리 | 팀장·팀원 누구나 추가 가능. 담당자·**종류(category)**·**순서(order)**·**최대 기한(dueDate)** 을 설정. 할 일 삭제 시 **남은 할 일의 순서 자동 정리** |
| 할 일 순서 변경 | 팀장이 목록에서 **드래그 앤 드롭**으로 순서를 바꾸면 1,2,3…으로 자동 반영 |
| 마감 캘린더 | 할 일 마감일을 **달력(월간)**으로 한눈에 보기 (목록/캘린더 전환) |
| 내 할 일 모아보기 | 대시보드에서 **여러 프로젝트에 걸친 내 미완료 할 일**을 마감 임박순(D-day)으로 표시 |
| 작업 권한 | 자료 등록·PPT 업로드·대본 작성은 **해당 종류의 할 일을 배정받은 사람만** 가능 |
| 작업 바로가기 | 할 일을 클릭하면 그 종류의 작업 화면(자료조사/PPT 탭)으로 자동 이동 |
| 마감 알림 | 기한 **이틀 전 / 하루 전** 두 번 알림 (스케줄러가 매시 검사) |
| 브라우저 알림 | 권한을 켜면 새 알림을 **브라우저 푸시 알림**으로도 표시 |
| 지분 차감 | 기한을 넘기면 해당 팀원의 점수 −10 → 지분 하락. 기한 내 완료 시 +10 |
| 지분 산정 내역 | 점수가 **언제·왜 +10/−10** 되었는지 이력으로 확인 (멤버별 필터) |
| 순서 알림 | 한 일정이 완료되면 **다음 순서 담당자에게 즉시 알림** |
| 자료조사 모음 | 기사 / 논문 / 영상링크 / 기타를 종류별로 모아보기. **파일 첨부**와 **제목 검색** 지원 |
| 프로필 | 프로필 이미지·닉네임 변경, 학교/학과/학번(선택) 기입 |
| 알림 자동 읽음 | 알림 패널을 열면 자동으로 읽음 처리 |
| PPT 보관함 | ppt·pptx·pdf 업로드. **PDF는 슬라이드를 한 장씩 미리보기**하며 옆에서 장별 대본 작성. 세로/가로(←→ 키) 전환 |
| 메시지 | 프로젝트별 채팅 (3초 폴링), 프로필 아이콘 표시. 본인 메시지 삭제 시 "삭제된 메시지입니다" 표시. **@닉네임 멘션 시 알림** |
| 멤버 프로필 | 멤버를 클릭하면 프로필(역할·학교·학과 등)을 확인 |
| 지분 현황 | 팀장·팀원 모두의 지분을 점수 비율(%)과 막대그래프로 표시 |
| 다크 모드 | 상단바 버튼으로 라이트/다크 테마 전환 (브라우저에 저장) |

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
| `users` | userId, password(해시), nickname, email, avatar, school, major, studentId |
| `projects` | name, inviteCode(4자리, unique), leader, members[{user, role, isLeader, score}] |
| `tasks` | project, assignee, title, category(기사/논문/영상/PPT/대본/기타), order, dueDate, status, notifiedTwoDays, notifiedOneDay, penaltyApplied |
| `resources` | project, uploader, type(기사/논문/영상/기타), title, url(기타는 선택), memo, fileName/originalName(첨부) |
| `scorelogs` | project, user, delta(+10/−10), reason, task — 지분 변동 이력 |
| `ppts` | project, uploader, originalName, fileName, scripts[{slideNumber, script}] |
| `messages` | project, sender, content, deleted(소프트 삭제) |
| `notifications` | user, project, type(마감임박/기한초과/다음순서/멘션/일반), message, read |
| `verificationcodes` | email(unique), code(4자리), expiresAt(10분 후 TTL 자동 삭제) |

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

> 자료·PPT **삭제**는 **등록(업로드)한 본인만** 가능합니다. 팀장이라도 다른 사람이 올린 자료는 삭제할 수 없습니다. (단, 프로젝트 전체 삭제는 팀장만 가능)

## 지분 계산 방식

- 모든 멤버는 **기본 100점**으로 시작합니다.
- 할 일을 **기한 내 완료**하면 **+10점**, **기한 초과** 시 **−10점**.
- 가산점을 받은 할 일을 **삭제하거나 완료를 취소하면 +10점도 회수**됩니다.
- 지분(%) = 내 점수 ÷ 팀 전체 점수 합 × 100

## API 요약

```
POST   /api/auth/signup                      회원가입
POST   /api/auth/login                       로그인
POST   /api/auth/find/send-code              아이디/비밀번호 찾기 인증코드 발송
POST   /api/auth/find/verify-code            인증코드 확인 → 아이디 반환
POST   /api/auth/find/reset-password         인증 후 비밀번호 재설정
GET    /api/projects                         내 프로젝트 목록
GET    /api/projects/my-tasks                여러 프로젝트의 내 미완료 할 일 (마감순)
POST   /api/projects                         프로젝트 생성 (초대코드 자동 부여)
POST   /api/projects/join                    초대 코드로 참가
GET    /api/projects/:id                     프로젝트 상세
DELETE /api/projects/:id                     프로젝트 삭제 (팀장)
PUT    /api/projects/:id/members/:uid/role   역할 부여 (팀장)
GET    /api/projects/:id/shares              지분 조회
GET    /api/projects/:id/score-logs          지분 산정 내역
POST   /api/projects/:id/tasks               할 일 생성 (팀장·팀원)
GET    /api/projects/:id/tasks               할 일 목록
PUT    /api/projects/:id/tasks/reorder       할 일 순서 일괄 변경 (드래그 앤 드롭)
PUT    /api/projects/:id/tasks/:tid/status   상태 변경 (완료 시 다음 순서 알림)
POST   /api/projects/:id/resources           자료 등록
GET    /api/projects/:id/resources           자료 목록 (?type= 종류 · ?q= 제목 검색)
POST   /api/projects/:id/ppts                PPT 업로드
PUT    /api/projects/:id/ppts/:pid/scripts   장별 대본 저장
POST   /api/projects/:id/messages            메시지 전송
GET    /api/projects/:id/messages            메시지 목록 (?after= 폴링)
DELETE /api/projects/:id/messages/:mid       메시지 삭제 (보낸 사람, 소프트 삭제)
GET    /api/notifications                    내 알림
PUT    /api/notifications/read-all           모두 읽음
```
