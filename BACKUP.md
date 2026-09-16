# Backup and restore

Two things hold state: the SQLite file (`DATABASE_PATH`) and the uploads
folder (`UPLOAD_DIR`). Back them up together; a file row without its file,
or a file without its row, is useless.

## Backup (while the service is running)

SQLite in WAL mode is safe to copy through its own backup command, never by
copying the `.db` file alone.

```bash
# on the Render shell (paths from render.yaml)
mkdir -p /var/data/backups
node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/var/data/revive-portal.db');
  db.exec(\"VACUUM INTO '/var/data/backups/revive-portal-\" + new Date().toISOString().slice(0,10) + \".db'\");
  db.close();
"
tar -czf /var/data/backups/uploads-$(date +%F).tgz -C /var/data uploads
```

Then copy the two files off the box (`render` CLI, `scp` from a shell, or a
scheduled job that ships them to R2/S3). Keep at least the last 7 daily
copies; the disk is not a backup.

## Restore

1. Stop the service (Render → Manual Deploy → Suspend, or scale to 0).
2. Replace the database: `cp revive-portal-YYYY-MM-DD.db /var/data/revive-portal.db`
   and delete any stale `revive-portal.db-wal` / `-shm` next to it.
3. Restore uploads: `tar -xzf uploads-YYYY-MM-DD.tgz -C /var/data`.
4. Start the service. Migrations newer than the backup are applied
   automatically on boot (`pnpm migrate` does the same by hand).
5. Sign in and open one project's Files tab — every download should work.

## Local snapshot

```bash
sqlite3 data/revive-portal.db ".backup data/backup.db"   # or the VACUUM INTO above
```
