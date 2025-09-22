-- 큐 예약 조회를 위한 PostgreSQL 함수 생성
-- 피드백 페이지 오류 해결용

CREATE OR REPLACE FUNCTION get_queue_reservations(
  target_date DATE,
  target_period TEXT,
  target_teacher_id INTEGER
)
RETURNS TABLE (
  id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id, 
    r.created_at
  FROM reservations r
  JOIN reservation_slots sl ON r.slot_id = sl.id
  WHERE sl.date = target_date
    AND sl.session_period = target_period
    AND sl.teacher_id = target_teacher_id
  ORDER BY r.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 함수 테스트용 쿼리 (실행하여 정상 작동 확인)
-- 실제 데이터로 테스트:
SELECT * FROM get_queue_reservations('2025-09-22'::date, 'AM', 22);

-- 함수 권한 설정 (필요시)
-- GRANT EXECUTE ON FUNCTION get_queue_reservations(DATE, TEXT, INTEGER) TO anon, authenticated;