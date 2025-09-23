-- 특정 세션의 데이터 확인 쿼리들 (세션 ID를 실제 값으로 교체)
-- 사용법: 오류가 발생한 세션 ID로 <SESSION_ID> 부분을 교체하여 실행

-- 1. 세션 기본 정보 확인
SELECT 
  s.id as session_id,
  s.status,
  s.reservation_id,
  s.problem_id,
  s.created_at,
  s.started_at,
  s.completed_at
FROM sessions s 
WHERE s.id = <SESSION_ID>;

-- 2. 예약 정보와 슬롯 정보 확인  
SELECT 
  r.id as reservation_id,
  r.student_id,
  r.slot_id,
  r.created_at as reservation_created_at,
  sl.id as slot_id,
  sl.date as slot_date,
  sl.time_slot,
  sl.session_period,
  sl.teacher_id,
  t.name as teacher_name,
  st.name as student_name
FROM sessions s
JOIN reservations r ON s.reservation_id = r.id
JOIN reservation_slots sl ON r.slot_id = sl.id
JOIN accounts t ON sl.teacher_id = t.id
JOIN accounts st ON r.student_id = st.id
WHERE s.id = <SESSION_ID>;

-- 3. 큐 계산을 위한 같은 날짜/세션/교사의 모든 예약 확인
-- (위 쿼리 결과의 slot_date, session_period, teacher_id 값을 사용)
SELECT 
  r.id as reservation_id,
  r.created_at as reservation_created_at,
  sl.date as slot_date,
  sl.session_period,
  sl.teacher_id,
  st.name as student_name,
  ROW_NUMBER() OVER (ORDER BY r.created_at ASC) as queue_position
FROM reservations r
JOIN reservation_slots sl ON r.slot_id = sl.id
JOIN accounts st ON r.student_id = st.id
WHERE sl.date = '<SLOT_DATE>'
  AND sl.session_period = '<SESSION_PERIOD>'
  AND sl.teacher_id = '<TEACHER_ID>'
ORDER BY r.created_at ASC;

-- 4. 문제 발생 가능성 진단 쿼리
-- 날짜 형식 불일치 확인
SELECT 
  r.id as reservation_id,
  sl.date,
  sl.date::text as date_text,
  DATE(sl.date) as date_only,
  TO_CHAR(sl.date, 'YYYY-MM-DD') as formatted_date
FROM sessions s
JOIN reservations r ON s.reservation_id = r.id
JOIN reservation_slots sl ON r.slot_id = sl.id
WHERE s.id = <SESSION_ID>;

-- 5. 슬롯 참조 무결성 확인
SELECT 
  'reservations' as table_name,
  COUNT(*) as count
FROM reservations r
LEFT JOIN reservation_slots sl ON r.slot_id = sl.id
WHERE sl.id IS NULL
UNION ALL
SELECT 
  'slots_without_teacher' as table_name,
  COUNT(*) as count  
FROM reservation_slots sl
LEFT JOIN accounts t ON sl.teacher_id = t.id
WHERE t.id IS NULL;

-- 실제 사용 예시 (세션 ID가 123이라면):
/*
-- 1단계: 세션 정보 확인
SELECT * FROM sessions WHERE id = 123;

-- 2단계: 예약-슬롯 조인 확인  
SELECT 
  r.id, r.created_at,
  sl.date, sl.session_period, sl.teacher_id
FROM sessions s
JOIN reservations r ON s.reservation_id = r.id  
JOIN reservation_slots sl ON r.slot_id = sl.id
WHERE s.id = 123;

-- 3단계: 결과를 바탕으로 큐 확인
SELECT 
  r.id, r.created_at,
  ROW_NUMBER() OVER (ORDER BY r.created_at ASC) as position
FROM reservations r
JOIN reservation_slots sl ON r.slot_id = sl.id
WHERE sl.date = '2024-01-15'  -- 실제 날짜로 교체
  AND sl.session_period = 1   -- 실제 세션 기간으로 교체
  AND sl.teacher_id = 456     -- 실제 교사 ID로 교체
ORDER BY r.created_at ASC;
*/