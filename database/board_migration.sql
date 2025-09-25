-- 선생님 게시판 기능을 위한 데이터베이스 마이그레이션
-- 실행일: 2025년

-- 게시판 게시글 테이블
CREATE TABLE board_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    author_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 게시글 댓글 테이블
CREATE TABLE board_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    author_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 성능 최적화를 위한 인덱스
CREATE INDEX idx_board_posts_created_at ON board_posts(created_at DESC);
CREATE INDEX idx_board_posts_author_id ON board_posts(author_id);
CREATE INDEX idx_board_comments_post_id ON board_comments(post_id);
CREATE INDEX idx_board_comments_created_at ON board_comments(created_at DESC);

-- 게시글 조회수 업데이트를 위한 함수
CREATE OR REPLACE FUNCTION increment_post_view_count(post_id INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE board_posts 
    SET view_count = view_count + 1,
        updated_at = NOW()
    WHERE id = post_id;
END;
$$ LANGUAGE plpgsql;

-- 댓글 수를 빠르게 조회하기 위한 뷰 (선택사항)
CREATE VIEW board_posts_with_stats AS
SELECT 
    p.*,
    COALESCE(c.comment_count, 0) as comment_count,
    a.name as author_name,
    a.class_name as author_class_name
FROM board_posts p
LEFT JOIN (
    SELECT post_id, COUNT(*) as comment_count
    FROM board_comments
    GROUP BY post_id
) c ON p.id = c.post_id
LEFT JOIN accounts a ON p.author_id = a.id
ORDER BY p.created_at DESC;