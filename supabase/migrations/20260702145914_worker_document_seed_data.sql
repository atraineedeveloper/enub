INSERT INTO "public"."worker_document_categories" ("name", "scope", "sort_order")
VALUES
    ('Datos personales', 'permanent', 10),
    ('Docencia', 'semester', 20),
    ('Tutoría', 'semester', 30),
    ('Asesoría', 'semester', 40),
    ('Investigación', 'semester', 50)
ON CONFLICT ("name") DO UPDATE
SET
    "scope" = EXCLUDED."scope",
    "sort_order" = EXCLUDED."sort_order";

WITH "document_types" ("category_name", "name", "allows_multiple", "sort_order") AS (
    VALUES
        ('Datos personales', 'Acta de nacimiento', false, 10),
        ('Datos personales', 'CURP', false, 20),
        ('Datos personales', 'Curriculum Vitae actualizado', false, 30),
        ('Datos personales', 'Credencial de elector', false, 40),
        ('Datos personales', 'Constancia de situación fiscal (SAT)', false, 50),
        ('Datos personales', 'Nombramiento', false, 60),
        ('Docencia', 'Planeación semestral', false, 10),
        ('Docencia', 'Plan de trabajo semestral', false, 20),
        ('Docencia', 'Planeaciones semanales', false, 30),
        ('Docencia', 'Rúbricas', false, 40),
        ('Docencia', 'Listas de cotejo', false, 50),
        ('Docencia', 'Evidencias', true, 60),
        ('Docencia', 'Listas de asistencia', false, 70),
        ('Docencia', 'Actas de evaluación', false, 80),
        ('Docencia', 'Concentrado de calificaciones finales', false, 90),
        ('Tutoría', 'Relación de estudiantes tutorados', false, 10),
        ('Tutoría', 'Canalizaciones', false, 20),
        ('Tutoría', 'Evidencias de actividades', true, 30),
        ('Tutoría', 'Listas de asistencia', false, 40),
        ('Tutoría', 'Informes de tutoría', false, 50),
        ('Asesoría', 'Control de asesorías', false, 10),
        ('Asesoría', 'Evidencias', true, 20),
        ('Asesoría', 'Documentos de titulación', false, 30),
        ('Asesoría', 'Informes', false, 40),
        ('Investigación', 'Artículos publicados', false, 10),
        ('Investigación', 'Ponencias', false, 20),
        ('Investigación', 'Capítulos de libro', false, 30),
        ('Investigación', 'Informes técnicos', false, 40),
        ('Investigación', 'Productos académicos diversos', false, 50)
)
INSERT INTO "public"."worker_document_types" (
    "category_id",
    "name",
    "allows_multiple",
    "sort_order"
)
SELECT
    "worker_document_categories"."id",
    "document_types"."name",
    "document_types"."allows_multiple",
    "document_types"."sort_order"
FROM "document_types"
JOIN "public"."worker_document_categories"
    ON "worker_document_categories"."name" = "document_types"."category_name"
ON CONFLICT ("category_id", "name") DO UPDATE
SET
    "allows_multiple" = EXCLUDED."allows_multiple",
    "sort_order" = EXCLUDED."sort_order";
