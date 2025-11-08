-- Enable the pgvector extension for vector similarity search
-- Run this in your Supabase SQL Editor

-- Step 1: Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Drop existing function if it exists (in case of schema changes)
-- This allows us to recreate the function with updated return types
-- We need to drop all versions of the function regardless of parameter types

-- Drop all overloaded versions of the function
DO $$
DECLARE
    r record;
BEGIN
    -- Find and drop all functions with this name
    FOR r IN 
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname = 'match_document_chunks'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- Step 3: Create the match_document_chunks function for vector similarity search
-- This function performs cosine similarity search on embeddings
-- 
-- IMPORTANT: The embedding dimension (768) must match your embedding model
-- - Gemini text-embedding-004 uses 768 dimensions
-- - When your backend starts, it will print the actual dimension
-- - If different, update all occurrences of "vector(768)" below to match your dimension
-- - Also update your document_chunks table schema to match

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(768),  -- Update this dimension if needed
  match_user_id text,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  user_id text,
  filename text,
  chunk text,
  embedding vector(768),  -- Update this dimension if needed
  similarity float,
  created_at timestamp
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.user_id,
    document_chunks.filename,
    document_chunks.chunk,
    document_chunks.embedding,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity,
    document_chunks.created_at
  FROM document_chunks
  WHERE document_chunks.user_id = match_user_id
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 4: Create an index on the embedding column for faster similarity search
-- This uses the HNSW index type which is optimized for vector similarity search
-- Note: If the index already exists with different parameters, you may need to drop it first
-- DROP INDEX IF EXISTS document_chunks_embedding_idx;
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Step 5: Create an index on user_id and filename for faster lookups
CREATE INDEX IF NOT EXISTS document_chunks_user_filename_idx 
ON document_chunks (user_id, filename);

-- Step 6: Verify the function exists
-- You can test it with:
-- SELECT * FROM match_document_chunks(
--   (SELECT embedding FROM document_chunks LIMIT 1),
--   'your-user-id',
--   5
-- );

