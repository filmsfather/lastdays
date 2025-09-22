# Database Migration: Queue Function Fix

## 문제 상황
- 피드백 페이지에서 "큐에서 예약을 찾을 수 없습니다" 오류가 간헐적으로 발생
- Supabase nested query의 불안정한 작동으로 인한 문제

## 해결 방법
PostgreSQL 함수를 생성하여 안정적인 큐 조회 구현

## 배포 순서

### 1. DB 함수 생성
```sql
-- 파일: create_queue_function.sql 내용을 Supabase Dashboard에서 실행
-- 또는 psql/다른 PostgreSQL 클라이언트에서 실행
```

### 2. 함수 동작 테스트
```sql
-- 실제 데이터로 테스트
SELECT * FROM get_queue_reservations('2025-09-22'::date, 'AM', 22);
```

### 3. API 변경사항 배포
- `/src/app/api/sessions/[id]/feedback-data/route.ts` 변경사항이 이미 적용됨
- 애플리케이션 재시작/재배포

### 4. 테스트 확인
- 이전에 오류가 발생했던 피드백 페이지들에 접근해보기
- 브라우저 콘솔에서 오류 메시지 확인
- 큐 위치가 정상적으로 표시되는지 확인

## 롤백 방법
문제 발생 시 이전 코드로 롤백:
```typescript
// 이전 코드로 복원
const { data: queueData, error: queueError } = await supabase
  .from('reservations')
  .select(`
    id,
    created_at,
    slot:slot_id (
      date,
      session_period,
      teacher:teacher_id (id)
    )
  `)
  .eq('slot.date', reservationDate)
  .eq('slot.session_period', (reservation.slot as any).session_period)
  .eq('slot.teacher_id', (reservation.slot as any).teacher.id)
  .order('created_at', { ascending: true })
```

## 예상 효과
- 피드백 페이지 접근 오류 해결
- 큐 계산 안정성 향상
- 데이터베이스 조회 성능 개선