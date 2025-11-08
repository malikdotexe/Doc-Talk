# Supabase Setup Guide for PDF Indexing

This guide will help you set up Supabase for PDF indexing and vector search in your Doc-Talk project.

## Prerequisites

1. A Supabase project (create one at https://supabase.com)
2. Your Supabase project URL and service role key
3. Access to the Supabase SQL Editor

## Step 1: Database Tables

Your Supabase database should already have these tables (based on your schema):

### `user_documents` table
```sql
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, filename)
);
```

### `document_chunks` table
```sql
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  chunk TEXT NOT NULL,
  embedding vector(768) NOT NULL,  -- Adjust dimension based on your embedding model
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Important**: The embedding dimension (768) should match your embedding model. 
- Gemini `text-embedding-004` uses **768 dimensions**
- If you're using a different model, update the dimension accordingly

## Step 2: Enable pgvector Extension

Run this in your Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Step 3: Create the Vector Search Function

Run the SQL migration file `supabase_migration.sql` in your Supabase SQL Editor. This will:

1. Enable the pgvector extension
2. Create the `match_document_chunks` function for vector similarity search
3. Create indexes for optimal performance

**To run the migration:**
1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `supabase_migration.sql`
4. Click "Run"

## Step 4: Verify Embedding Dimension

When you start your Python backend, it will print the embedding dimension. Make sure this matches your database schema:

```
✅ Embedding dimension: 768 (ensure your Supabase vector column matches this)
```

If the dimension doesn't match:
1. Check what dimension your embedding model uses
2. Update the `document_chunks` table schema:
   ```sql
   ALTER TABLE document_chunks 
   ALTER COLUMN embedding TYPE vector(<your-dimension>);
   ```
3. Update the `match_document_chunks` function in `supabase_migration.sql` to use the correct dimension

## Step 5: Storage Bucket Setup

1. Go to Storage in your Supabase Dashboard
2. Create a bucket named `pdfs` (if it doesn't exist)
3. Configure the bucket:
   - **Public**: Set to `false` (private)
   - **File size limit**: 10 MB (or your preferred limit)
   - **Allowed MIME types**: `application/pdf`

## Step 6: Storage Policies

Set up Row Level Security (RLS) policies for the storage bucket:

### Policy 1: Allow authenticated users to upload PDFs
```sql
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdfs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 2: Allow users to read their own PDFs
```sql
CREATE POLICY "Users can read their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 3: Allow users to delete their own PDFs
```sql
CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Step 7: Database RLS Policies

Set up Row Level Security for your tables:

### `user_documents` table policies
```sql
-- Enable RLS
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own documents
CREATE POLICY "Users can view their own documents"
ON user_documents FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

-- Policy: Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
ON user_documents FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
ON user_documents FOR DELETE
TO authenticated
USING (user_id = auth.uid()::text);
```

### `document_chunks` table policies
```sql
-- Enable RLS
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own chunks
CREATE POLICY "Users can view their own chunks"
ON document_chunks FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

-- Policy: Service role can insert chunks (for backend processing)
CREATE POLICY "Service role can insert chunks"
ON document_chunks FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Users can delete their own chunks
CREATE POLICY "Users can delete their own chunks"
ON document_chunks FOR DELETE
TO authenticated
USING (user_id = auth.uid()::text);
```

**Important**: The `document_chunks` table needs to allow inserts from the service role (your Python backend), since the backend processes PDFs and creates chunks.

## Step 8: Environment Variables

Make sure these environment variables are set in your backend (Render.com or your deployment platform):

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (found in Settings > API)
- `GOOGLE_API_KEY`: Your Google API key for Gemini embeddings

## Step 9: Test the Setup

1. Start your Python backend
2. Check the logs for the embedding dimension verification
3. Upload a test PDF through your frontend
4. Check the backend logs for processing status
5. Verify in Supabase:
   - Check `user_documents` table for the document metadata
   - Check `document_chunks` table for the indexed chunks
   - Try querying the documents through your chat interface

## Troubleshooting

### Error: "function match_document_chunks does not exist"
- Make sure you ran the SQL migration from `supabase_migration.sql`
- Verify the function exists in your Supabase SQL Editor:
  ```sql
  SELECT * FROM pg_proc WHERE proname = 'match_document_chunks';
  ```

### Error: "embedding dimension mismatch"
- Check the embedding dimension printed when your backend starts
- Update your database schema to match (see Step 4)

### Error: "Failed to download PDF from Supabase"
- Check your storage bucket name (should be `pdfs`)
- Verify the storage path format: `{user_id}/{filename}`
- Check storage policies allow service role access
- Verify the file was uploaded successfully

### Error: "No text extracted from PDF"
- Try enabling OCR mode for scanned PDFs
- Check if the PDF has text layers (some PDFs are image-only)
- Verify PyMuPDF (fitz) can open the PDF file

### PDFs upload but don't index
- Check backend logs for errors
- Verify the WebSocket connection is working
- Check that the `store_chunks_and_embeddings` function is being called
- Verify embeddings are being inserted into the database

## Support

If you encounter issues:
1. Check the backend logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test the Supabase connection independently
4. Check Supabase dashboard for any errors or issues

