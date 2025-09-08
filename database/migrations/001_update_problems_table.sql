-- 문제 테이블에 새 필드 추가 및 기존 필드 제거
-- 2025-09-08: PRD 요구사항에 맞춰 문제 테이블 구조 변경

-- 새 필드 추가
ALTER TABLE problems ADD COLUMN IF NOT EXISTS limit_minutes INTEGER CHECK (limit_minutes BETWEEN 1 AND 300);
ALTER TABLE problems ADD COLUMN IF NOT EXISTS available_date DATE;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- preview_lead_time 단위를 시간에서 분으로 변경 (기본값 10분)
ALTER TABLE problems ALTER COLUMN preview_lead_time SET DEFAULT 10;

-- 기존 데이터가 있다면 기본값 설정
UPDATE problems 
SET 
    limit_minutes = 60, -- 기본 60분
    available_date = CURRENT_DATE, -- 오늘 날짜
    images = '[]'::jsonb -- 빈 배열
WHERE limit_minutes IS NULL OR available_date IS NULL;

-- NOT NULL 제약조건 추가
ALTER TABLE problems ALTER COLUMN limit_minutes SET NOT NULL;
ALTER TABLE problems ALTER COLUMN available_date SET NOT NULL;

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_problems_available_date ON problems(available_date);
CREATE INDEX IF NOT EXISTS idx_problems_status_available_date ON problems(status, available_date);