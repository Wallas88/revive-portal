const VERSION_COLUMNS = `dv.id, dv.deliverable_id AS deliverableId, dv.version_number AS versionNumber, dv.note, dv.preview_url AS previewUrl,
  dv.file_id AS fileId, dv.created_at AS createdAt, creator.name AS createdBy,
  f.original_name AS fileName, f.mime_type AS fileMime, f.size_bytes AS fileSize`

export function deliverableQueries(db) {
  const versionsFor = db.prepare(`
    SELECT ${VERSION_COLUMNS} FROM deliverable_versions dv
    JOIN users creator ON creator.id = dv.created_by
    LEFT JOIN files f ON f.id = dv.file_id AND f.deleted_at IS NULL
    WHERE dv.deliverable_id = ? ORDER BY dv.version_number DESC
  `)
  const requestsFor = db.prepare(`
    SELECT ar.id, ar.deliverable_version_id AS versionId, ar.message, ar.status, ar.due_date AS dueDate, ar.created_at AS createdAt, ar.resolved_at AS resolvedAt, requester.name AS requestedBy
    FROM approval_requests ar JOIN users requester ON requester.id = ar.requested_by
    WHERE ar.deliverable_version_id = ? ORDER BY ar.id DESC
  `)
  const responsesFor = db.prepare(`
    SELECT r.id, r.decision, r.feedback, r.created_at AS createdAt, u.name AS respondedBy
    FROM approval_responses r JOIN users u ON u.id = r.responded_by WHERE r.approval_request_id = ? ORDER BY r.id
  `)
  return {
    list: (projectId) => db.prepare('SELECT id, title, description, created_at AS createdAt FROM deliverables WHERE project_id = ? ORDER BY id DESC').all(projectId),
    get: (projectId, id) => db.prepare('SELECT id, project_id AS projectId, title, description, created_at AS createdAt FROM deliverables WHERE project_id = ? AND id = ?').get(projectId, id),
    listWithVersions(projectId) {
      return this.list(projectId).map((d) => ({
        ...d,
        versions: versionsFor.all(d.id).map((v) => ({ ...v, requests: requestsFor.all(v.id).map((r) => ({ ...r, responses: responsesFor.all(r.id) })) })),
      }))
    },
    insert: (projectId, { title, description }, createdBy) => db.prepare('INSERT INTO deliverables (project_id, title, description, created_by) VALUES (?, ?, ?, ?) RETURNING id').get(projectId, title, description ?? '', createdBy),

    nextVersionNumber: (deliverableId) => db.prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM deliverable_versions WHERE deliverable_id = ?').get(deliverableId).next,
    insertVersion: (deliverableId, { note, previewUrl, fileId }, createdBy) => {
      const versionNumber = db.prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM deliverable_versions WHERE deliverable_id = ?').get(deliverableId).next
      return db.prepare('INSERT INTO deliverable_versions (deliverable_id, version_number, note, preview_url, file_id, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, version_number AS versionNumber')
        .get(deliverableId, versionNumber, note ?? '', previewUrl ?? null, fileId ?? null, createdBy)
    },
    // A version is only reachable through its project — the join is the check.
    versionInProject: (projectId, versionId) => db.prepare(`
      SELECT dv.id, dv.deliverable_id AS deliverableId, dv.version_number AS versionNumber, d.title AS deliverableTitle
      FROM deliverable_versions dv JOIN deliverables d ON d.id = dv.deliverable_id WHERE d.project_id = ? AND dv.id = ?
    `).get(projectId, versionId),
    fileInProject: (projectId, fileId) => db.prepare('SELECT id FROM files WHERE project_id = ? AND id = ? AND deleted_at IS NULL').get(projectId, fileId),

    openRequestForVersion: (versionId) => db.prepare("SELECT id FROM approval_requests WHERE deliverable_version_id = ? AND status = 'pending'").get(versionId),
    insertRequest: (versionId, { message, dueDate }, requestedBy) => db.prepare('INSERT INTO approval_requests (deliverable_version_id, requested_by, message, due_date) VALUES (?, ?, ?, ?) RETURNING id').get(versionId, requestedBy, message ?? '', dueDate ?? null),
    requestInProject: (projectId, requestId) => db.prepare(`
      SELECT ar.id, ar.status, ar.deliverable_version_id AS versionId, dv.version_number AS versionNumber, d.id AS deliverableId, d.title AS deliverableTitle
      FROM approval_requests ar JOIN deliverable_versions dv ON dv.id = ar.deliverable_version_id JOIN deliverables d ON d.id = dv.deliverable_id
      WHERE d.project_id = ? AND ar.id = ?
    `).get(projectId, requestId),
    insertResponse: (requestId, { decision, feedback }, respondedBy) => db.prepare('INSERT INTO approval_responses (approval_request_id, responded_by, decision, feedback) VALUES (?, ?, ?, ?) RETURNING id').get(requestId, respondedBy, decision, feedback ?? ''),
    resolveRequest: (requestId, status) => db.prepare('UPDATE approval_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, requestId),
    responses: (requestId) => responsesFor.all(requestId),

    // What still needs a client decision, project-wide (also used by the dashboard).
    pendingRequests: (projectId) => db.prepare(`
      SELECT ar.id, ar.message, ar.due_date AS dueDate, ar.created_at AS createdAt, dv.id AS versionId, dv.version_number AS versionNumber, d.id AS deliverableId, d.title AS deliverableTitle
      FROM approval_requests ar JOIN deliverable_versions dv ON dv.id = ar.deliverable_version_id JOIN deliverables d ON d.id = dv.deliverable_id
      WHERE d.project_id = ? AND ar.status = 'pending' ORDER BY ar.created_at
    `).all(projectId),
    // Every outstanding decision across all projects — the admin's queue.
    pendingEverywhere: () => db.prepare(`
      SELECT ar.id, ar.message, ar.due_date AS dueDate, ar.created_at AS createdAt, dv.version_number AS versionNumber, d.title AS deliverableTitle,
             p.id AS projectId, p.name AS projectName, c.name AS clientName
      FROM approval_requests ar JOIN deliverable_versions dv ON dv.id = ar.deliverable_version_id JOIN deliverables d ON d.id = dv.deliverable_id
      JOIN projects p ON p.id = d.project_id JOIN clients c ON c.id = p.client_id
      WHERE ar.status = 'pending' ORDER BY ar.created_at
    `).all(),
  }
}
