-- 마이그레이션: scores 테이블 구조 변경
-- 기존 1-5점 시스템에서 상,중상,중,중하,하 시스템으로 변경
-- 평가 항목 변경: 문제이해/해결접근/계산정확도/풀이설명 → 실기/전공지식/전공적합성/태도

BEGIN;

-- 1. 기존 scores 테이블을 백업
CREATE TABLE scores_backup AS SELECT * FROM scores;

-- 2. 기존 테이블 삭제
DROP TABLE scores;

-- 3. 새로운 구조로 scores 테이블 재생성
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    practical_skills VARCHAR(10) CHECK (practical_skills IN ('상', '중상', '중', '중하', '하')),
    major_knowledge VARCHAR(10) CHECK (major_knowledge IN ('상', '중상', '중', '중하', '하')),
    major_suitability VARCHAR(10) CHECK (major_suitability IN ('상', '중상', '중', '중하', '하')),
    attitude VARCHAR(10) CHECK (attitude IN ('상', '중상', '중', '중하', '하')),
    scored_by INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id)
);

-- 4. (선택사항) 기존 데이터가 있다면 점수 변환하여 이관
-- 1-2점 → 하, 3점 → 중하, 4점 → 중, 5점 → 상으로 변환
INSERT INTO scores (
    session_id,
    practical_skills,
    major_knowledge,
    major_suitability,
    attitude,
    scored_by,
    created_at,
    updated_at
)
SELECT 
    session_id,
    CASE 
        WHEN problem_understanding <= 2 THEN '하'
        WHEN problem_understanding = 3 THEN '중하'
        WHEN problem_understanding = 4 THEN '중'
        WHEN problem_understanding = 5 THEN '상'
        ELSE '중'
    END as practical_skills,
    CASE 
        WHEN solution_approach <= 2 THEN '하'
        WHEN solution_approach = 3 THEN '중하'
        WHEN solution_approach = 4 THEN '중'
        WHEN solution_approach = 5 THEN '상'
        ELSE '중'
    END as major_knowledge,
    CASE 
        WHEN calculation_accuracy <= 2 THEN '하'
        WHEN calculation_accuracy = 3 THEN '중하'
        WHEN calculation_accuracy = 4 THEN '중'
        WHEN calculation_accuracy = 5 THEN '상'
        ELSE '중'
    END as major_suitability,
    CASE 
        WHEN presentation_clarity <= 2 THEN '하'
        WHEN presentation_clarity = 3 THEN '중하'
        WHEN presentation_clarity = 4 THEN '중'
        WHEN presentation_clarity = 5 THEN '상'
        ELSE '중'
    END as attitude,
    scored_by,
    created_at,
    updated_at
FROM scores_backup
WHERE problem_understanding IS NOT NULL 
   OR solution_approach IS NOT NULL 
   OR calculation_accuracy IS NOT NULL 
   OR presentation_clarity IS NOT NULL;

COMMIT;

-- 마이그레이션 검증 쿼리들
-- 백업된 데이터 확인
SELECT COUNT(*) as backup_count FROM scores_backup;

-- 새로운 데이터 확인
SELECT COUNT(*) as new_count FROM scores;

-- 변환된 데이터 샘플 확인
SELECT 
    session_id,
    practical_skills,
    major_knowledge,
    major_suitability,
    attitude
FROM scores 
LIMIT 5;

-- 백업 테이블은 확인 후 필요시 삭제
-- DROP TABLE scores_backup;