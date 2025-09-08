-- 이용권 수량 증가 함수 (최대 10개 제한, 트랜잭션 안전성 보장)
CREATE OR REPLACE FUNCTION increment_tickets(
    student_id INTEGER,
    increment_amount INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE accounts 
    SET current_tickets = LEAST(COALESCE(current_tickets, 0) + increment_amount, 10),
        updated_at = NOW()
    WHERE id = student_id AND role = 'student';
    
    -- 업데이트된 행이 있는지 확인
    IF FOUND THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 이용권 사용 함수 (세션 예약시 사용)
CREATE OR REPLACE FUNCTION use_ticket(
    student_id INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE accounts 
    SET current_tickets = GREATEST(COALESCE(current_tickets, 0) - 1, 0),
        updated_at = NOW()
    WHERE id = student_id AND role = 'student' AND COALESCE(current_tickets, 0) > 0;
    
    -- 업데이트된 행이 있는지 확인
    IF FOUND THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 예약 생성과 티켓 차감을 원자적으로 처리하는 함수 (타임슬롯 시스템)
CREATE OR REPLACE FUNCTION create_reservation_with_ticket_deduction(
    p_slot_id INTEGER,
    p_student_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_slot RECORD;
    v_student RECORD;
    v_date DATE;
    v_session_period VARCHAR(2);
    v_teacher_id INTEGER;
    v_reservation_count INTEGER;
    v_morning_reservations INTEGER;
    v_afternoon_reservations INTEGER;
    v_teacher_reservations INTEGER;
    v_reservation_id INTEGER;
    v_sequence_number INTEGER;
BEGIN
    -- 슬롯 존재 확인 및 정보 조회
    SELECT date, session_period, teacher_id, max_capacity, current_reservations, is_available
    INTO v_slot
    FROM reservation_slots 
    WHERE id = p_slot_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'slot_not_found';
    END IF;
    
    -- 슬롯이 예약 가능한지 확인 (쉬는시간이 아닌지)
    IF NOT v_slot.is_available THEN
        RAISE EXCEPTION 'slot_not_available';
    END IF;
    
    v_date := v_slot.date;
    v_session_period := v_slot.session_period;
    v_teacher_id := v_slot.teacher_id;
    
    -- 학생 존재 확인 및 티켓 보유량 확인
    SELECT id, name, class_name, current_tickets
    INTO v_student
    FROM accounts 
    WHERE id = p_student_id AND role = 'student';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'student_not_found';
    END IF;
    
    -- 이용권 보유량 확인
    IF v_student.current_tickets < 1 THEN
        RAISE EXCEPTION 'insufficient_tickets';
    END IF;
    
    -- 슬롯 용량 확인
    IF v_slot.current_reservations >= v_slot.max_capacity THEN
        RAISE EXCEPTION 'slot_full';
    END IF;
    
    -- 예약 규칙 검증
    
    -- 1. 하루 최대 3회 예약 확인
    SELECT COUNT(*)
    INTO v_reservation_count
    FROM reservations r
    JOIN reservation_slots rs ON r.slot_id = rs.id
    WHERE r.student_id = p_student_id 
      AND rs.date = v_date
      AND r.status = 'active';
    
    IF v_reservation_count >= 3 THEN
        RAISE EXCEPTION 'daily_limit_exceeded';
    END IF;
    
    -- 2. 오전/오후 교차 예약 방지 (AM/PM 세션)
    SELECT 
        COUNT(CASE WHEN rs.session_period = 'AM' THEN 1 END),
        COUNT(CASE WHEN rs.session_period = 'PM' THEN 1 END)
    INTO v_morning_reservations, v_afternoon_reservations
    FROM reservations r
    JOIN reservation_slots rs ON r.slot_id = rs.id
    WHERE r.student_id = p_student_id 
      AND rs.date = v_date
      AND r.status = 'active';
    
    -- 새로 예약하려는 세션이 오전인지 오후인지 확인
    IF (v_session_period = 'AM' AND v_afternoon_reservations > 0) OR 
       (v_session_period = 'PM' AND v_morning_reservations > 0) THEN
        RAISE EXCEPTION 'cross_block_violation';
    END IF;
    
    -- 3. 동일 교사 2회 제한 확인
    SELECT COUNT(*)
    INTO v_teacher_reservations
    FROM reservations r
    JOIN reservation_slots rs ON r.slot_id = rs.id
    WHERE r.student_id = p_student_id 
      AND rs.date = v_date
      AND rs.teacher_id = v_teacher_id
      AND r.status = 'active';
    
    IF v_teacher_reservations >= 2 THEN
        RAISE EXCEPTION 'teacher_limit_exceeded';
    END IF;
    
    -- 모든 검증 통과 시 예약 생성 및 티켓 차감
    
    -- 예약 생성
    INSERT INTO reservations (student_id, slot_id, status)
    VALUES (p_student_id, p_slot_id, 'active')
    RETURNING id INTO v_reservation_id;
    
    -- 순번 계산 (created_at 기준)
    SELECT COUNT(*) + 1
    INTO v_sequence_number
    FROM reservations r
    WHERE r.slot_id = p_slot_id 
      AND r.status = 'active'
      AND r.created_at < (SELECT created_at FROM reservations WHERE id = v_reservation_id);
    
    -- 슬롯의 현재 예약 수 증가
    UPDATE reservation_slots 
    SET current_reservations = current_reservations + 1,
        updated_at = NOW()
    WHERE id = p_slot_id;
    
    -- 학생의 이용권 차감
    UPDATE accounts 
    SET current_tickets = current_tickets - 1,
        updated_at = NOW()
    WHERE id = p_student_id;
    
    -- 결과 반환
    RETURN json_build_object(
        'reservation_id', v_reservation_id,
        'sequence_number', v_sequence_number,
        'tickets_deducted', 1,
        'remaining_tickets', v_student.current_tickets - 1
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- 예약 취소 함수 (티켓 환불 포함)
CREATE OR REPLACE FUNCTION cancel_reservation(
    p_reservation_id INTEGER,
    p_user_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_reservation RECORD;
    v_slot_id INTEGER;
    v_student_id INTEGER;
BEGIN
    -- 예약 존재 확인
    SELECT id, student_id, slot_id, status
    INTO v_reservation
    FROM reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'reservation_not_found';
    END IF;
    
    IF v_reservation.status != 'active' THEN
        RAISE EXCEPTION 'reservation_not_active';
    END IF;
    
    v_slot_id := v_reservation.slot_id;
    v_student_id := v_reservation.student_id;
    
    -- 권한 확인: 본인 또는 관리자만 취소 가능
    IF v_student_id != p_user_id THEN
        -- 관리자 권한 확인
        IF NOT EXISTS (
            SELECT 1 FROM accounts 
            WHERE id = p_user_id AND role = 'admin'
        ) THEN
            RAISE EXCEPTION 'insufficient_permission';
        END IF;
    END IF;
    
    -- 예약 취소
    UPDATE reservations 
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- 슬롯의 현재 예약 수 감소
    UPDATE reservation_slots 
    SET current_reservations = current_reservations - 1,
        updated_at = NOW()
    WHERE id = v_slot_id;
    
    -- 학생 이용권 환불
    UPDATE accounts 
    SET current_tickets = current_tickets + 1,
        updated_at = NOW()
    WHERE id = v_student_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'reservation_cancelled',
        'tickets_refunded', 1
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- 특정 학생의 예약 규칙 검증 함수 (타임슬롯 시스템)
CREATE OR REPLACE FUNCTION validate_reservation_rules(
    p_student_id INTEGER,
    p_date DATE,
    p_session_period VARCHAR(2),
    p_teacher_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_daily_count INTEGER;
    v_morning_count INTEGER;
    v_afternoon_count INTEGER;
    v_teacher_count INTEGER;
    v_result JSON;
BEGIN
    -- 하루 예약 수 확인
    SELECT COUNT(*)
    INTO v_daily_count
    FROM reservations r
    JOIN reservation_slots rs ON r.slot_id = rs.id
    WHERE r.student_id = p_student_id 
      AND rs.date = p_date
      AND r.status = 'active';
    
    -- 오전/오후 예약 수 확인
    SELECT 
        COUNT(CASE WHEN rs.session_period = 'AM' THEN 1 END),
        COUNT(CASE WHEN rs.session_period = 'PM' THEN 1 END)
    INTO v_morning_count, v_afternoon_count
    FROM reservations r
    JOIN reservation_slots rs ON r.slot_id = rs.id
    WHERE r.student_id = p_student_id 
      AND rs.date = p_date
      AND r.status = 'active';
    
    -- 동일 교사 예약 수 확인
    SELECT COUNT(*)
    INTO v_teacher_count
    FROM reservations r
    JOIN reservation_slots rs ON r.slot_id = rs.id
    WHERE r.student_id = p_student_id 
      AND rs.date = p_date
      AND rs.teacher_id = p_teacher_id
      AND r.status = 'active';
    
    -- 결과 구성
    v_result := json_build_object(
        'daily_reservations', v_daily_count,
        'morning_reservations', v_morning_count,
        'afternoon_reservations', v_afternoon_count,
        'teacher_reservations', v_teacher_count,
        'can_reserve_daily', v_daily_count < 3,
        'can_reserve_cross_block', 
            CASE 
                WHEN p_session_period = 'AM' THEN v_afternoon_count = 0
                WHEN p_session_period = 'PM' THEN v_morning_count = 0
                ELSE false
            END,
        'can_reserve_teacher', v_teacher_count < 2
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 예약 수정 함수 (슬롯 변경)
CREATE OR REPLACE FUNCTION update_reservation(
    p_reservation_id INTEGER,
    p_new_slot_id INTEGER,
    p_old_slot_id INTEGER
) RETURNS JSON AS $$
BEGIN
    -- 예약의 슬롯 ID 업데이트
    UPDATE reservations 
    SET slot_id = p_new_slot_id,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- 기존 슬롯의 현재 예약 수 감소
    UPDATE reservation_slots 
    SET current_reservations = current_reservations - 1,
        updated_at = NOW()
    WHERE id = p_old_slot_id;
    
    -- 새 슬롯의 현재 예약 수 증가
    UPDATE reservation_slots 
    SET current_reservations = current_reservations + 1,
        updated_at = NOW()
    WHERE id = p_new_slot_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'reservation_updated'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- 문제 선택 시 세션 생성 및 문제 스냅샷 저장 함수
CREATE OR REPLACE FUNCTION create_session_with_problem(
    p_reservation_id INTEGER,
    p_problem_id INTEGER,
    p_problem_snapshot JSONB
) RETURNS JSON AS $$
DECLARE
    v_session_id INTEGER;
    v_reflection_id INTEGER;
BEGIN
    -- 세션 생성
    INSERT INTO sessions (
        reservation_id, 
        problem_id, 
        problem_snapshot, 
        status, 
        started_at
    )
    VALUES (
        p_reservation_id,
        p_problem_id,
        p_problem_snapshot,
        'active',
        NOW()
    )
    RETURNING id INTO v_session_id;
    
    -- 예약의 problem_selected 플래그 업데이트
    UPDATE reservations 
    SET problem_selected = TRUE,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- student_reflections 초기 빈 레코드 생성
    INSERT INTO student_reflections (
        session_id,
        reflection_text,
        areas_for_improvement
    )
    VALUES (
        v_session_id,
        '',
        ''
    )
    RETURNING id INTO v_reflection_id;
    
    RETURN json_build_object(
        'success', true,
        'session_id', v_session_id,
        'reflection_id', v_reflection_id,
        'message', 'session_created_with_problem_snapshot'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$ LANGUAGE plpgsql;