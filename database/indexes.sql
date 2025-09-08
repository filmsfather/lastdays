-- Last Days 시스템 성능 최적화 인덱스

-- accounts 테이블 인덱스
CREATE INDEX idx_accounts_role ON accounts(role);
CREATE INDEX idx_accounts_class_name ON accounts(class_name);
CREATE INDEX idx_accounts_name ON accounts(name);
CREATE INDEX idx_accounts_role_class ON accounts(role, class_name);

-- tickets 테이블 인덱스
CREATE INDEX idx_tickets_student_id ON tickets(student_id);
CREATE INDEX idx_tickets_week_dates ON tickets(week_start_date, week_end_date);
CREATE INDEX idx_tickets_student_week ON tickets(student_id, week_start_date);

-- reservation_slots 테이블 인덱스
CREATE INDEX idx_reservation_slots_date ON reservation_slots(date);
CREATE INDEX idx_reservation_slots_block ON reservation_slots(block);
CREATE INDEX idx_reservation_slots_teacher_id ON reservation_slots(teacher_id);
CREATE INDEX idx_reservation_slots_date_block_teacher ON reservation_slots(date, block, teacher_id);
CREATE INDEX idx_reservation_slots_teacher_date ON reservation_slots(teacher_id, date);

-- reservations 테이블 인덱스
CREATE INDEX idx_reservations_student_id ON reservations(student_id);
CREATE INDEX idx_reservations_slot_id ON reservations(slot_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_student_created_desc ON reservations(student_id, created_at DESC);
CREATE INDEX idx_reservations_student_status ON reservations(student_id, status);

-- problems 테이블 인덱스
CREATE INDEX idx_problems_status ON problems(status);
CREATE INDEX idx_problems_difficulty ON problems(difficulty_level);
CREATE INDEX idx_problems_created_by ON problems(created_by);
CREATE INDEX idx_problems_subject_area ON problems(subject_area);
CREATE INDEX idx_problems_scheduled_publish ON problems(scheduled_publish_at);
CREATE INDEX idx_problems_status_difficulty ON problems(status, difficulty_level);

-- sessions 테이블 인덱스
CREATE INDEX idx_sessions_reservation_id ON sessions(reservation_id);
CREATE INDEX idx_sessions_problem_id ON sessions(problem_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_sessions_completed_at ON sessions(completed_at);

-- scores 테이블 인덱스 (session_id는 이미 UNIQUE 제약조건이 있음)
CREATE INDEX idx_scores_scored_by ON scores(scored_by);
CREATE INDEX idx_scores_total_score ON scores(total_score);
CREATE INDEX idx_scores_scored_by_created ON scores(scored_by, created_at DESC);

-- feedbacks 테이블 인덱스
CREATE INDEX idx_feedbacks_session_id ON feedbacks(session_id);
CREATE INDEX idx_feedbacks_given_by ON feedbacks(given_by);
CREATE INDEX idx_feedbacks_type ON feedbacks(feedback_type);
CREATE INDEX idx_feedbacks_given_by_created ON feedbacks(given_by, created_at DESC);

-- checklist_items 테이블 인덱스
CREATE INDEX idx_checklist_items_session_id ON checklist_items(session_id);
CREATE INDEX idx_checklist_items_checked ON checklist_items(is_checked);
CREATE INDEX idx_checklist_items_checked_by ON checklist_items(checked_by);

-- student_reflections 테이블 인덱스 (session_id는 이미 UNIQUE 제약조건이 있음)
CREATE INDEX idx_student_reflections_assessment ON student_reflections(self_assessment);
CREATE INDEX idx_student_reflections_created ON student_reflections(created_at DESC);