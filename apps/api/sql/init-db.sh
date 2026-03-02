#!/usr/bin/env bash
set -euo pipefail

echo "Waiting for SQL Server..."
until /opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -P "$SQL_SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

echo "Applying schema script..."
/opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -P "$SQL_SA_PASSWORD" -C -b -i /sql/001_init.sql

echo "Applying seed script..."
/opt/mssql-tools18/bin/sqlcmd -S sqlserver -U sa -P "$SQL_SA_PASSWORD" -C -b -i /sql/002_seed.sql

echo "Database init complete."
