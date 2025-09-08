-- PIN 기반 인증 시스템으로 마이그레이션
-- class_name 없이 name과 PIN만으로 인증하도록 변경

-- 마이그레이션 시작 로그
DO $$
BEGIN
    RAISE NOTICE 'Starting PIN-based authentication migration...';
END $$;

-- 1. PIN을 고유 제약조건으로 설정 (PIN 중복 방지)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'accounts_pin_unique'
    ) THEN
        -- 기존 PIN 중복 확인
        IF EXISTS (
            SELECT pin FROM accounts GROUP BY pin HAVING COUNT(*) > 1
        ) THEN
            RAISE NOTICE 'Duplicate PINs found. Updating duplicate PINs...';
            
            -- 중복 PIN 해결: 시퀀스를 이용해 고유한 PIN 생성
            WITH duplicate_pins AS (
                SELECT id, pin, 
                       ROW_NUMBER() OVER (PARTITION BY pin ORDER BY id) as rn
                FROM accounts
            ),
            pins_to_update AS (
                SELECT id FROM duplicate_pins WHERE rn > 1
            )
            UPDATE accounts 
            SET pin = LPAD((10000 + id)::text, 4, '0')  -- ID 기반 고유 PIN 생성
            WHERE id IN (SELECT id FROM pins_to_update);
            
            RAISE NOTICE 'Updated duplicate PINs';
        END IF;
        
        -- 고유 제약조건 추가
        ALTER TABLE accounts ADD CONSTRAINT accounts_pin_unique UNIQUE (pin);
        RAISE NOTICE 'Added unique constraint on PIN';
    ELSE
        RAISE NOTICE 'PIN unique constraint already exists';
    END IF;
END $$;

-- 2. class_name을 선택적 필드로 변경 (NOT NULL 제약 제거)
DO $$
BEGIN
    -- class_name을 nullable로 변경
    ALTER TABLE accounts ALTER COLUMN class_name DROP NOT NULL;
    RAISE NOTICE 'Made class_name nullable';
END $$;

-- 3. 기존 데이터에 대해 class_name을 선택적으로 유지 (기존 데이터는 그대로)
-- class_name은 표시 목적으로만 사용되고 인증에는 사용되지 않음

-- 4. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_accounts_name_pin ON accounts(name, pin);
CREATE INDEX IF NOT EXISTS idx_accounts_pin ON accounts(pin);

-- 5. 테스트 데이터 업데이트 (PIN 중복 방지)
DO $$
BEGIN
    -- 관리자 계정 확인/생성
    INSERT INTO accounts (name, class_name, role, pin, current_tickets)
    SELECT '관리자', 'admin', 'admin', '1234', 0
    WHERE NOT EXISTS (
        SELECT 1 FROM accounts WHERE pin = '1234'
    );
    
    -- 교사 계정 확인/생성
    INSERT INTO accounts (name, class_name, role, pin, current_tickets)
    SELECT '김선생', '수학교사', 'teacher', '5678', 0
    WHERE NOT EXISTS (
        SELECT 1 FROM accounts WHERE pin = '5678'
    );
    
    -- 학생 계정 확인/생성
    INSERT INTO accounts (name, class_name, role, pin, current_tickets)
    SELECT '김학생', '3-1', 'student', '9999', 5
    WHERE NOT EXISTS (
        SELECT 1 FROM accounts WHERE pin = '9999'
    );
    
    RAISE NOTICE 'Test accounts verified/created';
END $$;

-- 6. 마이그레이션 결과 확인
DO $$
DECLARE
    total_accounts INTEGER;
    unique_pins INTEGER;
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_accounts FROM accounts;
    SELECT COUNT(DISTINCT pin) INTO unique_pins FROM accounts;
    SELECT COUNT(*) - COUNT(DISTINCT pin) INTO duplicate_count FROM accounts;
    
    RAISE NOTICE '=== PIN Authentication Migration Completed ===';
    RAISE NOTICE 'Total accounts: %', total_accounts;
    RAISE NOTICE 'Unique PINs: %', unique_pins;
    RAISE NOTICE 'Duplicate PINs (should be 0): %', duplicate_count;
    RAISE NOTICE 'Authentication now uses: name + PIN only';
    RAISE NOTICE '================================================';
END $$;

-- 최종 검증 쿼리
SELECT 
    'PIN migration completed successfully' as status,
    COUNT(*) as total_accounts,
    COUNT(DISTINCT pin) as unique_pins,
    COUNT(*) - COUNT(DISTINCT pin) as duplicate_pins_remaining
FROM accounts;