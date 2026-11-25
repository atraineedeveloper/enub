# ENUB — Respaldo y recuperación

## Activación (después de fusionar este PR)

1. Generar una identidad age en un dispositivo confiable: `age-keygen -o enub-backup-key.txt`. Guardar dos copias privadas fuera de GitHub. Obtener destinatario público con `age-keygen -y enub-backup-key.txt`. Nunca compartir el archivo privado.
2. En Settings > Secrets and variables > Actions, crear secret `ENUB_BACKUP_DB_URL` con conexión PostgreSQL Session pooler, contraseña codificada si procede. Secret `ENUB_BACKUP_STORAGE_KEY` con clave servidor de Supabase, nunca clave frontend. Variables `ENUB_BACKUP_AGE_RECIPIENT` (age1...), `ENUB_BACKUP_SUPABASE_URL` y finalmente `ENUB_BACKUP_ENABLED=true`. No pegar credenciales en chats o código.
3. Actions > ENUB encrypted backup > Run workflow > full. Descargar únicamente artefacto cifrado y checksum; comprobar ejecución. El cron 08:00 UTC equivale a 02:00 en Tabasco; domingo full. GitHub puede retrasar cron.

## Recuperación aislada

Verificar `sha256sum -c backup.tar.gz.age.sha256`; descifrar `age -d -i enub-backup-key.txt -o backup.tar.gz backup.tar.gz.age`; extraer en carpeta privada vacía y verificar `sha256sum -c SHA256SUMS`. No ejecutar SQL contra producción. Seguir https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore en un proyecto descartable: revisar roles, schema, data, historial, políticas personalizadas auth/storage, configuraciones externas y Edge Functions por separado. Manifest storage/manifest.json relaciona cada objeto con su archivo binario; restaurar mediante Storage API a bucket/path original, verificar SHA256 y tamaños. No insertar ni eliminar objetos directamente en SQL. El proceso de exportación usa varias conexiones y no garantiza instantánea única entre DB y Storage: hacer respaldo pre-migración en periodo sin escrituras y comparar integridad. No se ha comprobado restauración real todavía.

## Cuota y seguridad

14 días SQL, 21 días full; tope 350 MB de artefactos de respaldo del repositorio, 100 MB de objetos por full. Si excede, falla sin borrar copias previas. Descargar periódicamente copias cifradas fuera de GitHub y revisar consumo global y egress. Presupuesto $0; no garantiza disponibilidad si se agotan cuotas. No incluir secretos en logs, repositorio ni artefactos. La clave servidor tiene amplios permisos: limitar acceso a main y revisar cambios de workflows. Antes de migrar, confirmar copia descifrable y restauración aislada.
