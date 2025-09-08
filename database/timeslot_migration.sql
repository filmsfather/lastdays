-- 타임슬롯 시스템으로 마이그레이션
-- 기존 AM/PM 블록을 10분 단위 타임슬롯으로 변경

-- 1. 기존 예약 데이터 정리
-- 외래키 제약조건을 피하기 위해 예약 데이터를 먼저 정리
TRUNCATE TABLE reservations CASCADE;
TRUNCATE TABLE sessions CASCADE;

-- 2. reservation_slots 테이블 구조 변경
-- 기존 테이블 삭제 후 재생성 (외래키 제약사항 때문)
DROP TABLE IF EXISTS reservation_slots CASCADE;

CREATE TABLE reservation_slots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    time_slot TIME NOT NULL,                    -- 실제 시간 (10:00, 10:10, 10:20, ...)
    session_period VARCHAR(2) NOT NULL CHECK (session_period IN ('AM', 'PM')), -- 오전/오후 구분
    teacher_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    max_capacity INTEGER NOT NULL DEFAULT 1,
    current_reservations INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,          -- 쉬는시간 설정용 (FALSE면 예약 불가)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, time_slot, teacher_id)        -- 날짜, 시간, 교사 조합으로 중복 방지
);

-- 3. 인덱스 생성
CREATE INDEX idx_reservation_slots_date_period ON reservation_slots(date, session_period);
CREATE INDEX idx_reservation_slots_teacher_date ON reservation_slots(teacher_id, date);
CREATE INDEX idx_reservation_slots_available ON reservation_slots(is_available, date);

-- 4. 타임슬롯 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_time_slots(
    p_date DATE,
    p_teacher_id INTEGER,
    p_am_start TIME DEFAULT '10:00'::TIME,
    p_am_end TIME DEFAULT '15:50'::TIME,
    p_pm_start TIME DEFAULT '16:00'::TIME,
    p_pm_end TIME DEFAULT '21:50'::TIME,
    p_interval_minutes INTEGER DEFAULT 10
) RETURNS INTEGER AS $$
DECLARE
    v_current_time TIME;
    v_session_period VARCHAR(2);
    v_slots_created INTEGER := 0;
BEGIN
    -- 오전 슬롯 생성
    v_current_time := p_am_start;
    WHILE v_current_time <= p_am_end LOOP
        INSERT INTO reservation_slots (date, time_slot, session_period, teacher_id)
        VALUES (p_date, v_current_time, 'AM', p_teacher_id)
        ON CONFLICT (date, time_slot, teacher_id) DO NOTHING;
        
        IF FOUND THEN
            v_slots_created := v_slots_created + 1;
        END IF;
        
        v_current_time := v_current_time + (p_interval_minutes || ' minutes')::INTERVAL;
    END LOOP;
    
    -- 오후 슬롯 생성  
    v_current_time := p_pm_start;
    WHILE v_current_time <= p_pm_end LOOP
        INSERT INTO reservation_slots (date, time_slot, session_period, teacher_id)
        VALUES (p_date, v_current_time, 'PM', p_teacher_id)
        ON CONFLICT (date, time_slot, teacher_id) DO NOTHING;
        
        IF FOUND THEN
            v_slots_created := v_slots_created + 1;
        END IF;
        
        v_current_time := v_current_time + (p_interval_minutes || ' minutes')::INTERVAL;
    END LOOP;
    
    RETURN v_slots_created;
END;
$$ LANGUAGE plpgsql;

-- 5. 슬롯 삭제 함수 (10분 단위)
CREATE OR REPLACE FUNCTION remove_time_slot(
    p_date DATE,
    p_time_slot TIME,
    p_teacher_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_reservations INTEGER;
BEGIN
    -- 해당 슬롯에 예약이 있는지 확인
    SELECT COUNT(*) INTO v_has_reservations
    FROM reservations r
    JOIN reservation_slots rs ON rs.id = r.slot_id
    WHERE rs.date = p_date 
      AND rs.time_slot = p_time_slot 
      AND rs.teacher_id = p_teacher_id
      AND r.status = 'active';
    
    -- 예약이 있으면 삭제 불가
    IF v_has_reservations > 0 THEN
        RAISE EXCEPTION 'cannot_delete_slot_with_reservations';
    END IF;
    
    -- 슬롯 삭제
    DELETE FROM reservation_slots 
    WHERE date = p_date 
      AND time_slot = p_time_slot 
      AND teacher_id = p_teacher_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 6. 쉬는시간 설정 함수
CREATE OR REPLACE FUNCTION set_break_time(
    p_date DATE,
    p_time_slot TIME,
    p_teacher_id INTEGER,
    p_is_break BOOLEAN DEFAULT TRUE
) RETURNS BOOLEAN AS $$
BEGIN
    -- 해당 슬롯에 예약이 있으면 쉬는시간 설정 불가
    IF p_is_break THEN
        PERFORM 1 FROM reservations r
        JOIN reservation_slots rs ON rs.id = r.slot_id
        WHERE rs.date = p_date 
          AND rs.time_slot = p_time_slot 
          AND rs.teacher_id = p_teacher_id
          AND r.status = 'active';
        
        IF FOUND THEN
            RAISE EXCEPTION 'cannot_set_break_time_with_reservations';
        END IF;
    END IF;
    
    -- 슬롯 가용성 업데이트
    UPDATE reservation_slots 
    SET is_available = NOT p_is_break,
        updated_at = NOW()
    WHERE date = p_date 
      AND time_slot = p_time_slot 
      AND teacher_id = p_teacher_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 7. reservations 테이블의 외래키 복원
ALTER TABLE reservations ADD CONSTRAINT fk_reservations_slot_id 
    FOREIGN KEY (slot_id) REFERENCES reservation_slots(id) ON DELETE CASCADE;

-- 8. 예시 데이터 생성 (교사 ID 1, 2에 대해 내일 슬롯 생성)
-- 실제 교사 ID는 accounts 테이블에서 확인 후 수정 필요
DO $$
DECLARE
    tomorrow DATE := CURRENT_DATE + INTERVAL '1 day';
    teacher_record RECORD;
BEGIN
    -- 모든 교사에 대해 슬롯 생성
    FOR teacher_record IN 
        SELECT id FROM accounts WHERE role = 'teacher'
    LOOP
        PERFORM generate_time_slots(tomorrow, teacher_record.id);
        RAISE NOTICE 'Generated slots for teacher %', teacher_record.id;
    END LOOP;
END $$;