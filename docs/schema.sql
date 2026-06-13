-- =============================================================================
--  조각(JOGAK) — 조별과제 매니저  관계형 DB 스키마 (MySQL 8.0+ / MariaDB)
-- -----------------------------------------------------------------------------
--  MongoDB 컬렉션 9개를 관계형 테이블로 변환한 스키마입니다.
--  · 내장 배열 projects.members[] → project_members 테이블로 분리
--  · 내장 배열 ppts.scripts[]    → ppt_scripts 테이블로 분리
--  문자셋: utf8mb4 (한글·이모지 안전)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS jogak
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE jogak;

-- 재실행 편의를 위해 자식 테이블부터 제거
DROP TABLE IF EXISTS ppt_scripts;
DROP TABLE IF EXISTS scorelogs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS ppts;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS verification_codes;
DROP TABLE IF EXISTS users;

-- -----------------------------------------------------------------------------
-- 1. users — 회원
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     VARCHAR(50)  NOT NULL,                 -- 로그인 ID
  password    VARCHAR(255) NOT NULL,                 -- bcrypt 해시
  nickname    VARCHAR(50)  NOT NULL,
  email       VARCHAR(255) NOT NULL,
  avatar      VARCHAR(255) NOT NULL DEFAULT '',       -- 프로필 이미지 파일명
  school      VARCHAR(100) NOT NULL DEFAULT '',
  major       VARCHAR(100) NOT NULL DEFAULT '',
  student_id  VARCHAR(50)  NOT NULL DEFAULT '',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_user_id (user_id),
  UNIQUE KEY uk_users_email   (email)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. projects — 프로젝트
-- -----------------------------------------------------------------------------
CREATE TABLE projects (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  name         VARCHAR(200) NOT NULL,
  description  TEXT         NULL,
  invite_code  CHAR(4)      NOT NULL,                 -- 4자리 초대 코드
  leader_id    BIGINT       NOT NULL,                 -- 팀장 (users)
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_projects_invite_code (invite_code),
  KEY idx_projects_leader (leader_id),
  CONSTRAINT fk_projects_leader
    FOREIGN KEY (leader_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. project_members — 프로젝트 멤버 (MongoDB projects.members[] 분리)
-- -----------------------------------------------------------------------------
CREATE TABLE project_members (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  project_id  BIGINT       NOT NULL,
  user_id     BIGINT       NOT NULL,
  role        VARCHAR(50)  NOT NULL DEFAULT '',        -- 역할 (예: 자료조사, PPT)
  is_leader   TINYINT(1)   NOT NULL DEFAULT 0,
  score       INT          NOT NULL DEFAULT 100,       -- 지분 점수 (기본 100, ±10)
  PRIMARY KEY (id),
  UNIQUE KEY uk_member (project_id, user_id),          -- 한 프로젝트에 동일 멤버 1회
  KEY idx_member_user (user_id),
  CONSTRAINT fk_member_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_member_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. tasks — 할 일
-- -----------------------------------------------------------------------------
CREATE TABLE tasks (
  id                BIGINT      NOT NULL AUTO_INCREMENT,
  project_id        BIGINT      NOT NULL,
  assignee_id       BIGINT      NOT NULL,              -- 담당자 (users)
  title             VARCHAR(200) NOT NULL,
  description       TEXT        NULL,
  category          ENUM('기사','논문','영상','PPT','대본','기타') NOT NULL DEFAULT '기타',
  task_order        INT         NOT NULL,              -- 진행 순서 ('order'는 예약어)
  due_date          DATETIME    NOT NULL,              -- 최대 기한
  status            ENUM('진행전','진행중','완료','기한초과') NOT NULL DEFAULT '진행전',
  completed_at      DATETIME    NULL,
  notified_two_days TINYINT(1)  NOT NULL DEFAULT 0,    -- D-2 알림 발송 여부
  notified_one_day  TINYINT(1)  NOT NULL DEFAULT 0,    -- D-1 알림 발송 여부
  penalty_applied   TINYINT(1)  NOT NULL DEFAULT 0,    -- 기한 초과 -10 적용 여부
  reward_applied    TINYINT(1)  NOT NULL DEFAULT 0,    -- 기한 내 완료 +10 적용 여부
  created_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_project_order (project_id, task_order),
  KEY idx_tasks_assignee (assignee_id),
  CONSTRAINT fk_tasks_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assignee
    FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. resources — 자료조사
-- -----------------------------------------------------------------------------
CREATE TABLE resources (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  project_id    BIGINT       NOT NULL,
  uploader_id   BIGINT       NOT NULL,                 -- 등록자 (users)
  type          ENUM('기사','논문','영상','기타') NOT NULL,
  title         VARCHAR(300) NOT NULL,
  url           VARCHAR(1000) NOT NULL DEFAULT '',      -- 기타 종류는 선택
  memo          TEXT         NULL,
  file_name     VARCHAR(255) NOT NULL DEFAULT '',       -- 첨부 저장명 (선택)
  original_name VARCHAR(255) NOT NULL DEFAULT '',       -- 첨부 원본명
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_resources_project (project_id),
  KEY idx_resources_uploader (uploader_id),
  CONSTRAINT fk_resources_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_resources_uploader
    FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. ppts — 발표자료
-- -----------------------------------------------------------------------------
CREATE TABLE ppts (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  project_id    BIGINT       NOT NULL,
  uploader_id   BIGINT       NOT NULL,                 -- 업로드한 사람 (users)
  original_name VARCHAR(255) NOT NULL,                 -- 원본 파일명
  file_name     VARCHAR(255) NOT NULL,                 -- 서버 저장 파일명
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ppts_project (project_id),
  KEY idx_ppts_uploader (uploader_id),
  CONSTRAINT fk_ppts_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_ppts_uploader
    FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. ppt_scripts — 슬라이드별 대본 (MongoDB ppts.scripts[] 분리)
-- -----------------------------------------------------------------------------
CREATE TABLE ppt_scripts (
  id           BIGINT NOT NULL AUTO_INCREMENT,
  ppt_id       BIGINT NOT NULL,
  slide_number INT    NOT NULL,                        -- 슬라이드 번호
  script       TEXT   NULL,                            -- 해당 장 대본
  PRIMARY KEY (id),
  UNIQUE KEY uk_ppt_slide (ppt_id, slide_number),      -- PPT당 슬라이드 번호 유일
  CONSTRAINT fk_scripts_ppt
    FOREIGN KEY (ppt_id) REFERENCES ppts (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. scorelogs — 지분 점수 변동 이력
-- -----------------------------------------------------------------------------
CREATE TABLE scorelogs (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  project_id  BIGINT       NOT NULL,
  user_id     BIGINT       NOT NULL,                   -- 점수가 변한 멤버
  delta       INT          NOT NULL,                   -- +10 / -10
  reason      VARCHAR(255) NOT NULL,                   -- 변동 사유
  task_id     BIGINT       NULL,                       -- 관련 할 일 (선택)
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scorelogs_project_created (project_id, created_at),
  KEY idx_scorelogs_user (user_id),
  CONSTRAINT fk_scorelogs_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_scorelogs_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_scorelogs_task
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 9. messages — 메시지(채팅)
-- -----------------------------------------------------------------------------
CREATE TABLE messages (
  id          BIGINT     NOT NULL AUTO_INCREMENT,
  project_id  BIGINT     NOT NULL,
  sender_id   BIGINT     NOT NULL,                     -- 보낸 사람 (users)
  content     TEXT       NULL,                         -- 소프트 삭제 시 NULL 가능
  deleted     TINYINT(1) NOT NULL DEFAULT 0,           -- 소프트 삭제
  created_at  DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_project_created (project_id, created_at),
  KEY idx_messages_sender (sender_id),
  CONSTRAINT fk_messages_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
  -- 삭제되지 않은 메시지는 내용 필수 (MongoDB의 조건부 required 대응)
  CONSTRAINT chk_messages_content
    CHECK (deleted = 1 OR content IS NOT NULL)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 10. notifications — 알림
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,                   -- 수신자
  project_id  BIGINT       NULL,                        -- 관련 프로젝트 (선택)
  type        ENUM('마감임박','기한초과','다음순서','멘션','일반') NOT NULL DEFAULT '일반',
  message     VARCHAR(500) NOT NULL,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,          -- 'read'는 가독성상 is_read
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_read_created (user_id, is_read, created_at),
  KEY idx_notifications_project (project_id),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_project
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 11. verification_codes — 이메일 인증코드 (아이디/비번 찾기, 10분 만료)
--     MongoDB의 TTL 인덱스는 MySQL에 없으므로 expires_at 컬럼으로 만료 판단.
--     (주기적 정리는 이벤트 스케줄러로 처리 — 아래 주석 참고)
-- -----------------------------------------------------------------------------
CREATE TABLE verification_codes (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  email       VARCHAR(255) NOT NULL,                   -- users.email 참조(논리적)
  code        CHAR(4)      NOT NULL,                   -- 4자리 인증코드
  expires_at  DATETIME     NOT NULL,                   -- 만료 시각
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_verification_email (email),
  KEY idx_verification_expires (expires_at)
) ENGINE=InnoDB;

-- (선택) 만료된 인증코드 자동 정리 — MySQL 이벤트 스케줄러
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT IF NOT EXISTS ev_purge_verification_codes
--   ON SCHEDULE EVERY 10 MINUTE
--   DO DELETE FROM verification_codes WHERE expires_at < NOW();

-- =============================================================================
--  참고
--  · MongoDB ObjectId(_id) → BIGINT AUTO_INCREMENT 대리키로 변환
--  · MongoDB 'order'/'read' 예약어 → task_order / is_read 로 변경
--  · 모든 자식 행은 부모(프로젝트/PPT) 삭제 시 ON DELETE CASCADE 로 함께 정리
--    (앱의 "프로젝트 삭제 시 관련 데이터 정리" 로직과 동일한 효과)
-- =============================================================================
