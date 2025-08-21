-- Materialized view for document relationships and lineage
-- This pre-computes complex relationships to improve Document Inspector performance

CREATE MATERIALIZED VIEW IF NOT EXISTS document_relationships AS
WITH RECURSIVE document_lineage AS (
  -- Base case: documents with no parent (root documents)
  SELECT 
    d.id,
    d.customer_uuid,
    d.file_name,
    d.asset_type,
    d.parent_document_id,
    d.created_at,
    0 as depth,
    ARRAY[d.id] as lineage_path,
    d.id as root_document_id
  FROM documents d
  WHERE d.parent_document_id IS NULL
  
  UNION ALL
  
  -- Recursive case: documents with parents
  SELECT 
    d.id,
    d.customer_uuid,
    d.file_name,
    d.asset_type,
    d.parent_document_id,
    d.created_at,
    dl.depth + 1,
    dl.lineage_path || d.id,
    dl.root_document_id
  FROM documents d
  INNER JOIN document_lineage dl ON d.parent_document_id = dl.id
),
document_stats AS (
  SELECT 
    d.id as document_id,
    COUNT(DISTINCT children.id) as child_count,
    COUNT(DISTINCT q.id) as question_count,
    COUNT(DISTINCT gs.id) as submission_count
  FROM documents d
  LEFT JOIN documents children ON children.parent_document_id = d.id
  LEFT JOIN questions q ON q.document_id = d.id
  LEFT JOIN grade_submissions gs ON (gs.original_document_id = d.id OR gs.rubric_document_id = d.id)
  GROUP BY d.id
)
SELECT 
  dl.id,
  dl.customer_uuid,
  dl.file_name,
  dl.asset_type,
  dl.parent_document_id,
  dl.created_at,
  dl.depth,
  dl.lineage_path,
  dl.root_document_id,
  ds.child_count,
  ds.question_count,
  ds.submission_count,
  -- Parent document info for quick lineage display
  parent_doc.file_name as parent_file_name,
  parent_doc.asset_type as parent_asset_type
FROM document_lineage dl
LEFT JOIN document_stats ds ON ds.document_id = dl.id
LEFT JOIN documents parent_doc ON parent_doc.id = dl.parent_document_id;

-- Index for fast customer-specific queries
CREATE INDEX IF NOT EXISTS idx_document_relationships_customer 
ON document_relationships (customer_uuid, id);

-- Index for parent-child relationships
CREATE INDEX IF NOT EXISTS idx_document_relationships_parent 
ON document_relationships (parent_document_id) WHERE parent_document_id IS NOT NULL;

-- Refresh function for the materialized view
CREATE OR REPLACE FUNCTION refresh_document_relationships()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY document_relationships;
END;
$$ LANGUAGE plpgsql;