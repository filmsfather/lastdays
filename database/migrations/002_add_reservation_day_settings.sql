-- 요일별 예약 권한 설정 테이블 추가
-- 학생의 예약 가능 여부를 요일별로 제어

CREATE TABLE reservation_day_settings (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=일요일, 1=월요일, ..., 6=토요일
    is_enabled BOOLEAN NOT NULL DEFAULT true, -- 예약 가능 여부
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(day_of_week) -- 요일별로 하나의 설정만 허용
);

-- 기본값: 모든 요일 예약 허용
INSERT INTO reservation_day_settings (day_of_week, is_enabled) VALUES 
(0, true),  -- 일요일
(1, true),  -- 월요일
(2, true),  -- 화요일
(3, true),  -- 수요일
(4, true),  -- 목요일
(5, true),  -- 금요일
(6, true);  -- 토요일

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_reservation_day_settings_day_of_week ON reservation_day_settings(day_of_week);
CREATE INDEX idx_reservation_day_settings_is_enabled ON reservation_day_settings(is_enabled);