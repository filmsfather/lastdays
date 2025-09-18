-- 작법 예약 지원을 위한 스키마 추가
-- reservations 테이블에 type 컬럼 추가하여 일반/작법 예약 구분

-- 1. reservations 테이블에 type 컬럼 추가
ALTER TABLE reservations 
ADD COLUMN type VARCHAR(20) DEFAULT 'normal' 
CHECK (type IN ('normal', 'essay'));

-- 2. 작법 예약 그룹핑을 위한 essay_group_id 컬럼 추가
-- 작법 예약시 동일한 essay_group_id를 가진 2개의 예약이 생성됨
ALTER TABLE reservations 
ADD COLUMN essay_group_id UUID DEFAULT NULL;

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX idx_reservations_type ON reservations(type);
CREATE INDEX idx_reservations_essay_group ON reservations(essay_group_id);

-- 4. 기존 데이터 처리 (type이 NULL인 경우 'normal'로 설정)
UPDATE reservations 
SET type = 'normal' 
WHERE type IS NULL;

-- 5. 작법 예약 생성 함수 (2슬롯 동시 예약 + 티켓 2장 차감)
CREATE OR REPLACE FUNCTION create_essay_reservation(
    p_first_slot_id INTEGER,
    p_second_slot_id INTEGER,
    p_student_id INTEGER,
    p_essay_group_id UUID
) RETURNS TABLE(reservation_id INTEGER, slot_id INTEGER) AS $$
DECLARE
    first_reservation_id INTEGER;
    second_reservation_id INTEGER;
BEGIN
    -- 1. 학생 티켓 확인 (2장 이상 필요)
    IF (SELECT current_tickets FROM accounts WHERE id = p_student_id) < 2 THEN
        RAISE EXCEPTION 'insufficient_tickets';
    END IF;

    -- 2. 두 슬롯 모두 예약 가능한지 확인
    IF EXISTS (
        SELECT 1 FROM reservation_slots 
        WHERE id IN (p_first_slot_id, p_second_slot_id)
        AND current_reservations >= max_capacity
    ) THEN
        RAISE EXCEPTION 'slot_full';
    END IF;

    -- 3. 첫 번째 예약 생성
    INSERT INTO reservations (student_id, slot_id, type, essay_group_id, status)
    VALUES (p_student_id, p_first_slot_id, 'essay', p_essay_group_id, 'active')
    RETURNING id INTO first_reservation_id;

    -- 4. 두 번째 예약 생성
    INSERT INTO reservations (student_id, slot_id, type, essay_group_id, status)
    VALUES (p_student_id, p_second_slot_id, 'essay', p_essay_group_id, 'active')
    RETURNING id INTO second_reservation_id;

    -- 5. 슬롯 예약 카운트 증가
    UPDATE reservation_slots
    SET current_reservations = current_reservations + 1
    WHERE id IN (p_first_slot_id, p_second_slot_id);

    -- 6. 학생 티켓 2장 차감
    UPDATE accounts
    SET current_tickets = current_tickets - 2
    WHERE id = p_student_id;

    -- 7. 결과 반환
    RETURN QUERY 
    SELECT first_reservation_id, p_first_slot_id
    UNION ALL
    SELECT second_reservation_id, p_second_slot_id;

END;
$$ LANGUAGE plpgsql;