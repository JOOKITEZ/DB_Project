# 🗂️ 조각(JOGAK) — DB 스키마 한눈에 보기

MongoDB(Mongoose) 기반. **컬렉션 9개**의 구조·제약·인덱스·관계를 한 파일에 정리했습니다.
시각적 다이어그램은 [`docs/ERD.png`](./ERD.png) / [`docs/ERD.pdf`](./ERD.pdf) 참고.

> 표기: 🔑 PK · 🔗 FK(참조) · ⭐ UK(고유) · 📍 인덱스 · `[ ]` 내장 배열
> 모든 컬렉션은 `_id: ObjectId`(🔑)와 `createdAt`/`updatedAt: Date`(timestamps)를 기본 포함합니다.

---

## 📌 컬렉션 한눈 요약

| 컬렉션 | 한 줄 설명 | 핵심 관계 |
|---|---|---|
| `users` | 회원 계정·프로필 | — |
| `projects` | 프로젝트 + 멤버(내장) | leader 🔗 users / members[].user 🔗 users |
| `tasks` | 할 일(담당·기한·순서) | 🔗 projects, users |
| `resources` | 자료조사 모음 | 🔗 projects, users |
| `ppts` | 발표자료 + 슬라이드 대본(내장) | 🔗 projects, users |
| `scorelogs` | 지분 점수 변동 이력 | 🔗 projects, users, tasks |
| `messages` | 프로젝트 채팅 | 🔗 projects, users |
| `notifications` | 알림 | 🔗 users, projects |
| `verificationcodes` | 이메일 인증코드(TTL) | users.email 참조 |

---

## 1. `users` — 회원

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `userId` | String | required, ⭐ unique, trim | 로그인 ID |
| `password` | String | required | bcrypt 해시 저장 |
| `nickname` | String | required, trim | |
| `email` | String | required, ⭐ unique, lowercase, trim | |
| `avatar` | String | default `''` | 프로필 이미지 파일명 (`uploads/`) |
| `school` | String | default `''` | 학교 (선택) |
| `major` | String | default `''` | 학과 (선택) |
| `studentId` | String | default `''` | 학번 (선택) |

---

## 2. `projects` — 프로젝트

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `name` | String | required, trim | 프로젝트 이름 |
| `description` | String | default `''` | |
| `inviteCode` | String(4) | required, ⭐ unique | 4자리 초대 코드 |
| `leader` | ObjectId | required, 🔗 `users` | 팀장 |
| `members` | `[member]` | 내장 배열 | 아래 참조 |

### `members[]` — 내장 멤버 (서브도큐먼트, `_id` 없음)

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `user` | ObjectId | required, 🔗 `users` | 멤버 |
| `role` | String | default `''` | 역할 (예: 자료조사, PPT) |
| `isLeader` | Boolean | default `false` | 팀장 여부 |
| `score` | Number | default `100` | 지분 점수 (기본 100, ±10 변동) |

---

## 3. `tasks` — 할 일

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `project` | ObjectId | required, 🔗 `projects` | |
| `assignee` | ObjectId | required, 🔗 `users` | 담당자 |
| `title` | String | required, trim | |
| `description` | String | default `''` | |
| `category` | Enum | default `기타` | `기사` `논문` `영상` `PPT` `대본` `기타` |
| `order` | Number | required | 진행 순서 (완료 시 다음 순서 알림) |
| `dueDate` | Date | required | 최대 기한 |
| `status` | Enum | default `진행전` | `진행전` `진행중` `완료` `기한초과` |
| `completedAt` | Date | — | 완료 시각 |
| `notifiedTwoDays` | Boolean | default `false` | D-2 알림 발송 여부 |
| `notifiedOneDay` | Boolean | default `false` | D-1 알림 발송 여부 |
| `penaltyApplied` | Boolean | default `false` | 기한 초과 −10 적용 여부 |
| `rewardApplied` | Boolean | default `false` | 기한 내 완료 +10 적용 여부 |

📍 **인덱스**: `{ project: 1, order: 1 }`

---

## 4. `resources` — 자료조사

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `project` | ObjectId | required, 🔗 `projects` | |
| `uploader` | ObjectId | required, 🔗 `users` | 등록자 |
| `type` | Enum | required | `기사` `논문` `영상` `기타` |
| `title` | String | required, trim | |
| `url` | String | default `''`, trim | 기타 종류는 선택 |
| `memo` | String | default `''` | |
| `fileName` | String | default `''` | 첨부파일 저장명 (선택) |
| `originalName` | String | default `''` | 첨부파일 원본명 |

---

## 5. `ppts` — 발표자료

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `project` | ObjectId | required, 🔗 `projects` | |
| `uploader` | ObjectId | required, 🔗 `users` | 업로드한 사람 |
| `originalName` | String | required | 원본 파일명 |
| `fileName` | String | required | 서버 저장 파일명 |
| `scripts` | `[slideScript]` | 내장 배열 | 슬라이드별 대본 |

### `scripts[]` — 내장 슬라이드 대본 (`_id` 없음)

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `slideNumber` | Number | required | 슬라이드 번호 |
| `script` | String | default `''` | 해당 장 대본 |

---

## 6. `scorelogs` — 지분 점수 변동 이력

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `project` | ObjectId | required, 🔗 `projects` | |
| `user` | ObjectId | required, 🔗 `users` | 점수가 변한 멤버 |
| `delta` | Number | required | 변동값 (`+10` / `−10`) |
| `reason` | String | required | 사유 (예: "기한 내 완료: PPT 제작") |
| `task` | ObjectId | 🔗 `tasks` | 관련 할 일 (선택) |

📍 **인덱스**: `{ project: 1, createdAt: -1 }`

---

## 7. `messages` — 메시지(채팅)

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `project` | ObjectId | required, 🔗 `projects` | |
| `sender` | ObjectId | required, 🔗 `users` | 보낸 사람 |
| `content` | String | trim, **`deleted=false`일 때 required** | 본문 |
| `deleted` | Boolean | default `false` | 소프트 삭제 (내용 비우고 표시만 남김) |

📍 **인덱스**: `{ project: 1, createdAt: 1 }`

---

## 8. `notifications` — 알림

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `user` | ObjectId | required, 🔗 `users` | 수신자 |
| `project` | ObjectId | 🔗 `projects` | 관련 프로젝트 (선택) |
| `type` | Enum | default `일반` | `마감임박` `기한초과` `다음순서` `멘션` `일반` |
| `message` | String | required | |
| `read` | Boolean | default `false` | 읽음 여부 |

📍 **인덱스**: `{ user: 1, read: 1, createdAt: -1 }`

---

## 9. `verificationcodes` — 이메일 인증코드

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `_id` | ObjectId | 🔑 | |
| `email` | String | required, ⭐ unique | 인증 대상 이메일 (`users.email` 참조) |
| `code` | String(4) | required | 4자리 인증코드 |
| `expiresAt` | Date | required | 만료 시각 |

📍 **TTL 인덱스**: `{ expiresAt: 1 }`, `expireAfterSeconds: 0` → 만료 시 문서 자동 삭제 (10분)

---

## 🔗 관계도 (텍스트)

```
users ─┬─< projects.leader          (팀장, 1:N)
       ├─< projects.members[].user  (참여,  1:N · 내장)
       ├─< tasks.assignee           (담당,  1:N)
       ├─< resources.uploader       (등록,  1:N)
       ├─< ppts.uploader            (업로드,1:N)
       ├─< messages.sender          (발신,  1:N)
       ├─< notifications.user       (수신,  1:N)
       ├─< scorelogs.user           (기록,  1:N)
       └─· verificationcodes.email  (이메일 참조)

projects ─┬─< tasks.project
          ├─< resources.project
          ├─< ppts.project ─< ppts.scripts[]   (내장 1:N)
          ├─< messages.project
          ├─< notifications.project
          └─< scorelogs.project

tasks ──< scorelogs.task   (선택)
```

- **내장(Embedded)**: `projects.members[]`, `ppts.scripts[]` — 부모 문서 안에 직접 저장
- **참조(Reference)**: 그 외 모든 `ObjectId` 필드 — `ref`로 연결 후 `populate`로 조회

---

## 💯 지분 점수 규칙 (score 변동)

- 모든 멤버 **기본 100점** 시작 (`projects.members[].score`)
- 기한 내 완료 → **+10** (`rewardApplied`로 중복 방지)
- 기한 초과 → **−10** (`penaltyApplied`로 중복 방지)
- 완료 취소·완료된 할 일 삭제 → 받은 **+10 회수**
- 모든 변동은 `scorelogs`에 사유와 함께 기록
- 지분(%) = `내 score ÷ 팀 score 합 × 100`
