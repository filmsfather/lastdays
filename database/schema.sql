-- Last Days 수학 개별 학습 관리 시스템 데이터베이스 스키마

-- 계정 테이블 (학생, 교사, 관리자)
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    class_name VARCHAR(20) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    pin CHAR(4) NOT NULL,
    current_tickets INTEGER DEFAULT 0, -- 현재 보유 이용권 수량 (학생만 사용)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 이용권 발급 이력 테이블
CREATE TABLE tickets (
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

-- 예약 슬롯 테이블 (교사별 주간 스케줄)
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

-- 예약 테이블
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    slot_id INTEGER NOT NULL REFERENCES reservation_slots(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    problem_selected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 문제 테이블
CREATE TABLE problems (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
    subject_area VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    preview_lead_time INTEGER NOT NULL DEFAULT 24, -- 사전열람 리드타임 (시간)
    scheduled_publish_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 세션 테이블 (학생이 문제를 선택한 후 생성)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'feedback_pending', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 채점 테이블 (교사의 4항목 채점)
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    problem_understanding INTEGER CHECK (problem_understanding BETWEEN 1 AND 5),
    solution_approach INTEGER CHECK (solution_approach BETWEEN 1 AND 5),
    calculation_accuracy INTEGER CHECK (calculation_accuracy BETWEEN 1 AND 5),
    presentation_clarity INTEGER CHECK (presentation_clarity BETWEEN 1 AND 5),
    total_score INTEGER GENERATED ALWAYS AS (
        COALESCE(problem_understanding, 0) + 
        COALESCE(solution_approach, 0) + 
        COALESCE(calculation_accuracy, 0) + 
        COALESCE(presentation_clarity, 0)
    ) STORED,
    scored_by INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id)
);

-- 피드백 테이블 (교사의 서면 피드백)
CREATE TABLE feedbacks (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    feedback_type VARCHAR(50) DEFAULT 'general',
    given_by INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 체크리스트 항목 테이블
CREATE TABLE checklist_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_text VARCHAR(200) NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    checked_by INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 학생 복기 테이블
CREATE TABLE student_reflections (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    reflection_text TEXT NOT NULL,
    self_assessment INTEGER CHECK (self_assessment BETWEEN 1 AND 5),
    areas_for_improvement TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id)
);