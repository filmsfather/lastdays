-- 전날까지만 예약 수정 가능한지 확인하는 함수
CREATE OR REPLACE FUNCTION can_modify_reservation(
    p_slot_date DATE
) RETURNS BOOLEAN AS $$
BEGIN
    -- 전날 23:59까지만 수정 가능
    RETURN CURRENT_DATE < p_slot_date;
END;
$$ LANGUAGE plpgsql;

-- 예약 수정 함수 (전날까지만 수정 가능)
CREATE OR REPLACE FUNCTION update_reservation_with_date_check(
    p_reservation_id INTEGER,
    p_new_slot_id INTEGER,
    p_user_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_reservation RECORD;
    v_old_slot RECORD;
    v_new_slot RECORD;
    v_student_id INTEGER;
BEGIN
    -- 기존 예약 정보 조회
    SELECT r.id, r.student_id, r.slot_id, rs.date as slot_date
    INTO v_reservation
    FROM reservations r
    JOIN reservation_slots rs ON rs.id = r.slot_id
    WHERE r.id = p_reservation_id AND r.status = 'active';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'reservation_not_found';
    END IF;
    
    v_student_id := v_reservation.student_id;
    
    -- 권한 확인: 본인 또는 관리자만 수정 가능
    IF v_student_id != p_user_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM accounts 
            WHERE id = p_user_id AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'insufficient_permission';
        END IF;
    END IF;
    
    -- 날짜 제한 확인 (전날까지만 수정 가능)
    IF NOT can_modify_reservation(v_reservation.slot_date) THEN
        RAISE EXCEPTION 'modification_deadline_passed';
    END IF;
    
    -- 기존 슬롯 정보
    SELECT * INTO v_old_slot FROM reservation_slots WHERE id = v_reservation.slot_id;
    
    -- 새 슬롯 정보
    SELECT * INTO v_new_slot FROM reservation_slots WHERE id = p_new_slot_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'new_slot_not_found';
    END IF;
    
    -- 새 슬롯이 예약 가능한지 확인
    IF NOT v_new_slot.is_available THEN
        RAISE EXCEPTION 'new_slot_not_available';
    END IF;
    
    -- 새 슬롯에 용량이 있는지 확인
    IF v_new_slot.current_reservations >= v_new_slot.max_capacity THEN
        RAISE EXCEPTION 'new_slot_full';
    END IF;
    
    -- 새 슬롯에 대한 예약 규칙 검증 (기존 예약 제외)
    -- 임시로 기존 예약을 inactive로 변경해서 규칙 검증
    UPDATE reservations SET status = 'temp_inactive' WHERE id = p_reservation_id;
    
    -- 규칙 검증을 위해 함수 호출
    DECLARE
        v_validation RECORD;
        v_daily_count INTEGER;
        v_morning_count INTEGER;
        v_afternoon_count INTEGER;
        v_teacher_count INTEGER;
    BEGIN
        -- 하루 예약 수 확인
        SELECT COUNT(*) INTO v_daily_count
        FROM reservations r
        JOIN reservation_slots rs ON r.slot_id = rs.id
        WHERE r.student_id = v_student_id 
          AND rs.date = v_new_slot.date
          AND r.status = 'active';
        
        -- 오전/오후 예약 수 확인
        SELECT 
            COUNT(CASE WHEN rs.session_period = 'AM' THEN 1 END),
            COUNT(CASE WHEN rs.session_period = 'PM' THEN 1 END)
        INTO v_morning_count, v_afternoon_count
        FROM reservations r
        JOIN reservation_slots rs ON r.slot_id = rs.id
        WHERE r.student_id = v_student_id 
          AND rs.date = v_new_slot.date
          AND r.status = 'active';
        
        -- 동일 교사 예약 수 확인
        SELECT COUNT(*) INTO v_teacher_count
        FROM reservations r
        JOIN reservation_slots rs ON r.slot_id = rs.id
        WHERE r.student_id = v_student_id 
          AND rs.date = v_new_slot.date
          AND rs.teacher_id = v_new_slot.teacher_id
          AND r.status = 'active';
        
        -- 규칙 검증
        IF v_daily_count >= 3 THEN
            UPDATE reservations SET status = 'active' WHERE id = p_reservation_id;
            RAISE EXCEPTION 'daily_limit_exceeded';
        END IF;
        
        -- 오전/오후 교차 검증
        IF (v_new_slot.session_period = 'AM' AND v_afternoon_count > 0) OR 
           (v_new_slot.session_period = 'PM' AND v_morning_count > 0) THEN
            UPDATE reservations SET status = 'active' WHERE id = p_reservation_id;
            RAISE EXCEPTION 'cross_block_violation';
        END IF;
        
        -- 동일 교사 2회 제한
        IF v_teacher_count >= 2 THEN
            UPDATE reservations SET status = 'active' WHERE id = p_reservation_id;
            RAISE EXCEPTION 'teacher_limit_exceeded';
        END IF;
    END;
    
    -- 예약 정보 업데이트
    UPDATE reservations 
    SET slot_id = p_new_slot_id,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- 기존 슬롯의 현재 예약 수 감소
    UPDATE reservation_slots 
    SET current_reservations = current_reservations - 1,
        updated_at = NOW()
    WHERE id = v_reservation.slot_id;
    
    -- 새 슬롯의 현재 예약 수 증가
    UPDATE reservation_slots 
    SET current_reservations = current_reservations + 1,
        updated_at = NOW()
    WHERE id = p_new_slot_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'reservation_updated',
        'old_slot_id', v_reservation.slot_id,
        'new_slot_id', p_new_slot_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- 실패 시 원상복구
        UPDATE reservations SET status = 'active' WHERE id = p_reservation_id AND status = 'temp_inactive';
        RAISE;
END;
$$ LANGUAGE plpgsql;