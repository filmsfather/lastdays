-- 마이그레이션: scores 테이블에 evaluation_type 컬럼 추가
-- 평가 유형을 구분하는 컬럼 추가: '면접' 또는 '작법'

BEGIN;

-- 1. evaluation_type 컬럼 추가
ALTER TABLE scores 
ADD COLUMN evaluation_type VARCHAR(10) CHECK (evaluation_type IN ('면접', '작법'));

-- 2. 기존 데이터에 대해서는 '면접'으로 기본값 설정
UPDATE scores 
SET evaluation_type = '면접' 
WHERE evaluation_type IS NULL;

-- 3. (선택사항) 인덱스 추가 - 평가 유형별로 조회가 필요한 경우
CREATE INDEX idx_scores_evaluation_type ON scores(evaluation_type);

COMMIT;

-- 마이그레이션 검증 쿼리들
-- 추가된 컬럼 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'scores' AND column_name = 'evaluation_type';

-- 기존 데이터 확인
SELECT 
    evaluation_type,
    COUNT(*) as count
FROM scores 
GROUP BY evaluation_type;

-- 샘플 데이터 확인
SELECT 
    session_id,
    practical_skills,
    major_knowledge,
    major_suitability,
    attitude,
    evaluation_type,
    created_at
FROM scores 
ORDER BY created_at DESC
LIMIT 5;