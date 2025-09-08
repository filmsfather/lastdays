-- 문제 테이블에 이미지 지원 필드 추가
ALTER TABLE problems 
ADD COLUMN images JSONB DEFAULT '[]'::jsonb;

-- 이미지 필드에 대한 코멘트 추가
COMMENT ON COLUMN problems.images IS 'Array of image objects with url, alt_text, and order fields';

-- 예시 이미지 데이터 구조:
-- [
--   {
--     "url": "https://project.supabase.co/storage/v1/object/public/problem-images/problem_123_image_1.jpg",
--     "alt_text": "문제 다이어그램",
--     "order": 1,
--     "filename": "problem_123_image_1.jpg"
--   }
-- ]