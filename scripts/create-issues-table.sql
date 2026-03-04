-- Create issues table for customer success management
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    issue_category VARCHAR(100) NOT NULL DEFAULT 'General',
    status VARCHAR(50) NOT NULL DEFAULT 'Raised',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    company_id INTEGER REFERENCES companies(id),
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Add constraints
    CONSTRAINT valid_status CHECK (status IN ('Raised', 'In Progress', 'Blocked', 'Escalated', 'Resolved', 'Closed')),
    CONSTRAINT valid_priority CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_company_id ON issues(company_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(issue_category);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_issues_updated_at 
    BEFORE UPDATE ON issues 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO issues (title, description, issue_category, status, priority, company_id, created_by) VALUES
('Integration API timeout issues', 'API calls are timing out during peak hours', 'Technical', 'Raised', 'High', 1, 1),
('Data mapping discrepancies', 'Customer data fields not mapping correctly', 'Data Mapping', 'In Progress', 'Medium', 1, 1),
('UAT environment access', 'Client unable to access UAT environment', 'Access', 'Escalated', 'High', 2, 1),
('Performance optimization needed', 'System response time slower than expected', 'Performance', 'In Progress', 'Medium', 1, 2),
('Documentation update required', 'API documentation needs updating', 'Documentation', 'Raised', 'Low', 2, 2),
('Security certificate renewal', 'SSL certificate expiring soon', 'Security', 'Resolved', 'High', 1, 1),
('Database connection errors', 'Intermittent database connectivity issues', 'Technical', 'Blocked', 'Critical', 2, 1),
('User training session needed', 'Client team needs additional training', 'Training', 'Raised', 'Medium', 1, 2);

-- Update some records to have different timestamps for aging analysis
UPDATE issues SET created_at = CURRENT_TIMESTAMP - INTERVAL '45 days' WHERE id IN (1, 2);
UPDATE issues SET created_at = CURRENT_TIMESTAMP - INTERVAL '35 days' WHERE id IN (3, 4);
UPDATE issues SET created_at = CURRENT_TIMESTAMP - INTERVAL '70 days' WHERE id IN (5, 6);
UPDATE issues SET resolved_at = CURRENT_TIMESTAMP - INTERVAL '5 days' WHERE status = 'Resolved';

COMMIT;
