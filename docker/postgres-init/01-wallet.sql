-- Runs once, when the PostgreSQL container starts with an empty data volume.
-- Each service gets its own login role and a database that role owns.
CREATE ROLE wallet LOGIN PASSWORD 'wallet';
CREATE DATABASE wallet OWNER wallet;
REVOKE CONNECT ON DATABASE wallet FROM PUBLIC;
