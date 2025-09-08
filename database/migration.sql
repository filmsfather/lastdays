-- Task 3 관리자 계정 및 이용권 관리 시스템을 위한 스키마 마이그레이션
-- 최대 이용권 보유 제한 (10개) 포함
-- PRD 규격에 맞춘 AM/PM 블록 시스템으로 변경

-- 마이그레이션 시작 로그
DO $$
BEGIN
    RAISE NOTICE 'Starting Task 3 migration with AM/PM blocks and ticket limit (10 max)...';
END $$;

-- 1. accounts 테이블에 current_tickets 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounts' AND column_name = 'current_tickets'
    ) THEN
        ALTER TABLE accounts ADD COLUMN current_tickets INTEGER DEFAULT 0;
        RAISE NOTICE 'Added current_tickets column to accounts table';
    ELSE
        RAISE NOTICE 'current_tickets column already exists';
    END IF;
END $$;

-- 2. current_tickets 값이 10을 초과하는 경우 10으로 제한
UPDATE accounts 
SET current_tickets = 10 
WHERE current_tickets > 10;

-- 3. 기존 tickets 테이블 백업 (데이터가 있는 경우)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        -- 백업 테이블이 이미 존재하는 경우 삭제
        DROP TABLE IF EXISTS tickets_backup;
        
        -- 기존 데이터 백업
        CREATE TABLE tickets_backup AS SELECT * FROM tickets;
        RAISE NOTICE 'Backed up existing tickets table';
        
        -- 기존 tickets 테이블 삭제
        DROP TABLE tickets CASCADE;
        RAISE NOTICE 'Dropped old tickets table';
    ELSE
        RAISE NOTICE 'No existing tickets table found';
    END IF;
END $$;

-- 4. 새로운 tickets 테이블 생성 (발급 이력용)
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL, -- 발급된 이용권 수량
    type VARCHAR(50) NOT NULL DEFAULT 'individual_grant', -- 발급 유형 (weekly_bulk_issue, individual_grant)
    reason VARCHAR(200), -- 발급 사유
    issued_by INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, -- 발급자 (관리자)
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 이용권 관리 함수들 생성/업데이트
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

-- 이용권 현재 상태 조회 함수
CREATE OR REPLACE FUNCTION get_student_ticket_info(student_id INTEGER)
RETURNS TABLE(
    current_tickets INTEGER,
    max_tickets INTEGER,
    can_receive_more BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(a.current_tickets, 0) as current_tickets,
        10 as max_tickets,
        COALESCE(a.current_tickets, 0) < 10 as can_receive_more
    FROM accounts a
    WHERE a.id = student_id AND a.role = 'student';
END;
$$ LANGUAGE plpgsql;

-- 6. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_tickets_student_id ON tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_tickets_issued_by ON tickets(issued_by);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(type);
CREATE INDEX IF NOT EXISTS idx_tickets_issued_at ON tickets(issued_at);
CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role);
CREATE INDEX IF NOT EXISTS idx_accounts_current_tickets ON accounts(current_tickets);

-- 7. 제약 조건 추가 (이용권 수량 제한)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'check_current_tickets_limit'
    ) THEN
        ALTER TABLE accounts 
        ADD CONSTRAINT check_current_tickets_limit 
        CHECK (current_tickets >= 0 AND current_tickets <= 10);
        RAISE NOTICE 'Added ticket limit constraint (0-10)';
    ELSE
        RAISE NOTICE 'Ticket limit constraint already exists';
    END IF;
END $$;

-- 8. 기본 관리자 계정이 없는 경우 생성
INSERT INTO accounts (name, class_name, role, pin, current_tickets)
SELECT '관리자', 'ADMIN', 'admin', '0000', 0
WHERE NOT EXISTS (
    SELECT 1 FROM accounts WHERE role = 'admin'
);

-- 9. 마이그레이션 완료 확인 및 통계
DO $$
DECLARE
    total_accounts INTEGER;
    students INTEGER;
    admins INTEGER;
    max_ticket_students INTEGER;
    avg_tickets NUMERIC;
BEGIN
    SELECT COUNT(*) INTO total_accounts FROM accounts;
    SELECT COUNT(*) INTO students FROM accounts WHERE role = 'student';
    SELECT COUNT(*) INTO admins FROM accounts WHERE role = 'admin';
    SELECT COUNT(*) INTO max_ticket_students FROM accounts WHERE role = 'student' AND current_tickets = 10;
    SELECT ROUND(AVG(current_tickets), 2) INTO avg_tickets FROM accounts WHERE role = 'student';
    
    RAISE NOTICE '=== Migration Completed Successfully ===';
    RAISE NOTICE 'Total accounts: %', total_accounts;
    RAISE NOTICE 'Students: %', students;
    RAISE NOTICE 'Admins: %', admins;
    RAISE NOTICE 'Students with max tickets (10): %', max_ticket_students;
    RAISE NOTICE 'Average student tickets: %', COALESCE(avg_tickets, 0);
    RAISE NOTICE 'Ticket limit: 10 per student';
    RAISE NOTICE '==========================================';
END $$;

-- 10. Task 6를 위한 sessions 테이블 problem_snapshot 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'problem_snapshot'
    ) THEN
        ALTER TABLE sessions ADD COLUMN problem_snapshot JSONB;
        RAISE NOTICE 'Added problem_snapshot column to sessions table';
    ELSE
        RAISE NOTICE 'problem_snapshot column already exists';
    END IF;
END $$;

-- 11. 예약 및 세션 관리 함수들 생성
-- 예약 생성과 티켓 차감을 원자적으로 처리하는 함수
CREATE OR REPLACE FUNCTION create_reservation_with_ticket_deduction(
    p_slot_id INTEGER,
    p_student_id INTEGER
) RETURNS JSON AS $$
DECLARE
    v_slot RECORD;
    v_student RECORD;
    v_date DATE;
    v_block INTEGER;
    v_teacher_id INTEGER;
    v_reservation_count INTEGER;
    v_morning_reservations INTEGER;
    v_afternoon_reservations INTEGER;
    v_teacher_reservations INTEGER;
    v_reservation_id INTEGER;
    v_sequence_number INTEGER;
BEGIN
    -- 슬롯 존재 확인 및 정보 조회
    SELECT date, block, teacher_id, max_capacity, current_reservations
    INTO v_slot
    FROM reservation_slots 
    WHERE id = p_slot_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'slot_not_found';
    END IF;
    
    v_date := v_slot.date;
    v_block := v_slot.block;
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
    
    -- 2. 오전/오후 교차 예약 방지 (1-5교시: 오전, 6-10교시: 오후)
    SELECT 
        COUNT(CASE WHEN rs.block BETWEEN 1 AND 5 THEN 1 END),
        COUNT(CASE WHEN rs.block BETWEEN 6 AND 10 THEN 1 END)
    INTO v_morning_reservations, v_afternoon_reservations
    FROM reservations r
    JOIN reservation_slots rs ON r.slot_id = rs.id
    WHERE r.student_id = p_student_id 
      AND rs.date = v_date
      AND r.status = 'active';
    
    -- 새로 예약하려는 블록이 오전인지 오후인지 확인
    IF (v_block BETWEEN 1 AND 5 AND v_afternoon_reservations > 0) OR 
       (v_block BETWEEN 6 AND 10 AND v_morning_reservations > 0) THEN
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

-- 특정 학생의 예약 규칙 검증 함수
CREATE OR REPLACE FUNCTION validate_reservation_rules(
    p_student_id INTEGER,
    p_date DATE,
    p_block INTEGER,
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
        COUNT(CASE WHEN rs.block BETWEEN 1 AND 5 THEN 1 END),
        COUNT(CASE WHEN rs.block BETWEEN 6 AND 10 THEN 1 END)
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
                WHEN p_block BETWEEN 1 AND 5 THEN v_afternoon_count = 0
                WHEN p_block BETWEEN 6 AND 10 THEN v_morning_count = 0
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

-- AM/PM 블록 시스템으로 마이그레이션 (PRD 규격에 맞춤)
DO $$
BEGIN
    RAISE NOTICE 'Starting AM/PM block system migration...';
END $$;

-- 1. reservation_slots 테이블 백업 및 스키마 변경
DO $$
BEGIN
    -- 기존 데이터 백업
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservation_slots') THEN
        DROP TABLE IF EXISTS reservation_slots_backup;
        CREATE TABLE reservation_slots_backup AS SELECT * FROM reservation_slots;
        RAISE NOTICE 'Backed up existing reservation_slots table';
        
        -- 기존 테이블 삭제
        DROP TABLE reservation_slots CASCADE;
        RAISE NOTICE 'Dropped old reservation_slots table';
    END IF;
END $$;

-- 2. 새로운 reservation_slots 테이블 생성 (AM/PM 시스템)
CREATE TABLE reservation_slots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    block VARCHAR(2) NOT NULL CHECK (block IN ('AM', 'PM')),
    teacher_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    max_capacity INTEGER NOT NULL DEFAULT 1,
    current_reservations INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, block, teacher_id)
);

DO $$
BEGIN
    RAISE NOTICE 'Created new reservation_slots table with AM/PM blocks';
END $$;

-- 3. 기존 1-10 블록 데이터를 AM/PM으로 변환 (백업에서)
DO $$
DECLARE
    backup_record RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservation_slots_backup') THEN
        FOR backup_record IN 
            SELECT * FROM reservation_slots_backup 
        LOOP
            -- 1-5교시는 AM, 6-10교시는 PM으로 변환
            INSERT INTO reservation_slots (
                date, block, teacher_id, max_capacity, current_reservations, created_at, updated_at
            ) VALUES (
                backup_record.date,
                CASE WHEN backup_record.block BETWEEN 1 AND 5 THEN 'AM' ELSE 'PM' END,
                backup_record.teacher_id,
                backup_record.max_capacity,
                backup_record.current_reservations,
                backup_record.created_at,
                backup_record.updated_at
            )
            ON CONFLICT (date, block, teacher_id) DO NOTHING; -- 중복 방지
        END LOOP;
        
        RAISE NOTICE 'Converted existing block data to AM/PM system';
    END IF;
END $$;

-- 최종 검증 쿼리 (결과 반환)
SELECT 
    'Migration completed successfully with AM/PM blocks' as status,
    COUNT(*) as total_accounts,
    COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
    COUNT(CASE WHEN role = 'student' AND current_tickets = 10 THEN 1 END) as max_ticket_students,
    ROUND(AVG(CASE WHEN role = 'student' THEN current_tickets END), 2) as avg_student_tickets,
    (SELECT COUNT(*) FROM reservation_slots) as total_slots,
    (SELECT COUNT(*) FROM reservation_slots WHERE block = 'AM') as am_slots,
    (SELECT COUNT(*) FROM reservation_slots WHERE block = 'PM') as pm_slots
FROM accounts;