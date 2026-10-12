-- Plain footer wording for reports (no dash characters).
ALTER TABLE org_settings ALTER COLUMN report_footer SET DEFAULT 'Confidential. For internal use only.';
UPDATE org_settings SET report_footer = 'Confidential. For internal use only.'
WHERE report_footer = 'Confidential — for internal use only';
