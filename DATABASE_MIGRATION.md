# Database Migration: Add Workout Images Support

This migration adds support for attaching images to workout posts.

## Changes Required

### 1. Database Schema Update

Add the `image_url` column to the `workout_sessions` table:

```sql
-- Add image_url column to workout_sessions table
ALTER TABLE workout_sessions
ADD COLUMN image_url TEXT;
```

### 2. Storage Bucket Creation

Create a new storage bucket in Supabase for workout images:

#### Via Supabase Dashboard:
1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Name: `workout-images`
4. Public bucket: **Yes** (enable public access)
5. Click **Create bucket**

#### Set Bucket Policies:
Add these policies to allow authenticated users to upload and manage their workout images:

```sql
-- Policy: Enable authenticated users to upload workout images
CREATE POLICY "Users can upload workout images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'workout-images');

-- Policy: Enable public read access to workout images
CREATE POLICY "Public read access to workout images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'workout-images');

-- Policy: Enable users to delete their own workout images
CREATE POLICY "Users can delete their own workout images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'workout-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### 3. Run the Migration

#### Option A: Supabase Dashboard SQL Editor
1. Go to **SQL Editor** in your Supabase dashboard
2. Create a new query
3. Paste the SQL commands above
4. Click **Run**

#### Option B: Via Migration File (if using Supabase CLI)
Create a new migration file:

```bash
supabase migration new add_workout_images
```

Add the SQL commands to the generated migration file and run:

```bash
supabase db push
```

## Verification

After running the migration, verify:

1. **Database**: Check that `workout_sessions` table has the `image_url` column
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'workout_sessions';
   ```

2. **Storage**: Verify the `workout-images` bucket exists and has proper policies
   - Go to Storage > Policies in Supabase dashboard
   - Confirm the three policies are active

## Rollback (if needed)

To rollback this migration:

```sql
-- Remove the image_url column
ALTER TABLE workout_sessions
DROP COLUMN IF EXISTS image_url;

-- Delete the storage bucket (via Supabase dashboard Storage section)
-- Note: This will delete all workout images permanently
```

## Notes

- Existing workouts will have `image_url` set to `NULL` by default
- Images are stored with the format: `workout-images/{userId}-{timestamp}.{ext}`
- Supported formats: JPG, JPEG, PNG
- Maximum file size: Determined by your Supabase plan's storage limits
- Images are publicly accessible once uploaded (for display in the feed)
