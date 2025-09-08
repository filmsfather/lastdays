-- 데이터 보존 마이그레이션 (더 복잡하지만 안전)

-- 1. 임시 테이블에 기존 데이터 백업
CREATE TEMP TABLE reservation_backup AS 
SELECT r.*, rs.date, rs.block, rs.teacher_id 
FROM reservations r 
JOIN reservation_slots rs ON r.slot_id = rs.id;

CREATE TEMP TABLE session_backup AS 
SELECT s.*, rb.date, rb.block, rb.teacher_id
FROM sessions s 
JOIN reservation_backup rb ON s.reservation_id = rb.id;

-- 2. 외래키 제약조건 해제
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS fk_reservations_slot_id;

-- 3. 기존 테이블 삭제
DROP TABLE IF EXISTS reservation_slots CASCADE;

-- 4. 새 테이블 생성
CREATE TABLE reservation_slots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    time_slot TIME NOT NULL,
    session_period VARCHAR(2) NOT NULL CHECK (session_period IN ('AM', 'PM')),
    teacher_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    max_capacity INTEGER NOT NULL DEFAULT 1,
    current_reservations INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, time_slot, teacher_id)
);

-- 5. 기존 AM/PM 블록을 타임슬롯으로 변환해서 복원
INSERT INTO reservation_slots (date, time_slot, session_period, teacher_id, max_capacity, current_reservations)
SELECT 
    date,
    CASE 
        WHEN block = 'AM' THEN '10:00'::TIME  -- 오전은 10:00으로 통합
        WHEN block = 'PM' THEN '16:00'::TIME  -- 오후는 16:00으로 통합
    END,
    block,
    teacher_id,
    max_capacity,
    current_reservations
FROM (
    SELECT DISTINCT date, block, teacher_id, max_capacity, current_reservations
    FROM reservation_backup
) rb;

-- 6. 외래키 복원
ALTER TABLE reservations ADD CONSTRAINT fk_reservations_slot_id 
    FOREIGN KEY (slot_id) REFERENCES reservation_slots(id) ON DELETE CASCADE;

-- 7. 예약 데이터 복원 (새로운 slot_id로 매핑)
UPDATE reservations 
SET slot_id = (
    SELECT rs.id 
    FROM reservation_slots rs 
    JOIN reservation_backup rb ON rb.id = reservations.id
    WHERE rs.date = rb.date 
      AND rs.session_period = rb.block 
      AND rs.teacher_id = rb.teacher_id
    LIMIT 1
);

-- 8. 세션 데이터는 그대로 유지 (reservation_id가 그대로이므로)

-- 임시 테이블 정리는 세션 종료시 자동으로 됨