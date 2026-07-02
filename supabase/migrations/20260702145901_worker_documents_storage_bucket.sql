INSERT INTO "storage"."buckets" (
    "id",
    "name",
    "public",
    "file_size_limit",
    "allowed_mime_types"
)
VALUES (
    'worker_documents',
    'worker_documents',
    false,
    10485760,
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
ON CONFLICT ("id") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "public" = EXCLUDED."public",
    "file_size_limit" = EXCLUDED."file_size_limit",
    "allowed_mime_types" = EXCLUDED."allowed_mime_types";
