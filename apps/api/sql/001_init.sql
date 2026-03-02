SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [master];
GO

IF DB_ID(N'FundNest') IS NULL
BEGIN
  CREATE DATABASE [FundNest];
END;
GO

USE [FundNest];
GO

IF OBJECT_ID(N'dbo.Tenants', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Tenants (
    tenantId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    slug NVARCHAR(120) NOT NULL,
    archivedAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_Tenants_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Tenants_Slug UNIQUE (slug)
  );
END;
GO

IF COL_LENGTH('dbo.Tenants', 'archivedAt') IS NULL
BEGIN
  ALTER TABLE dbo.Tenants
  ADD archivedAt DATETIME2 NULL;
END;
GO

IF OBJECT_ID(N'dbo.TenantConfig', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TenantConfig (
    tenantId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    brandColor NVARCHAR(20) NOT NULL,
    logoUrl NVARCHAR(500) NULL,
    currency CHAR(3) NOT NULL CONSTRAINT DF_TenantConfig_Currency DEFAULT 'GBP',
    donationPresets NVARCHAR(MAX) NULL,
    CONSTRAINT FK_TenantConfig_Tenant FOREIGN KEY (tenantId)
      REFERENCES dbo.Tenants(tenantId)
      ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    userId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    tenantId UNIQUEIDENTIFIER NULL,
    email NVARCHAR(320) NOT NULL,
    passwordHash NVARCHAR(255) NOT NULL,
    role NVARCHAR(50) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Users_Tenant FOREIGN KEY (tenantId)
      REFERENCES dbo.Tenants(tenantId)
      ON DELETE CASCADE,
    CONSTRAINT UQ_Users_Tenant_Email UNIQUE (tenantId, email)
  );
END;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Users')
    AND name = 'tenantId'
    AND is_nullable = 0
)
BEGIN
  ALTER TABLE dbo.Users
  ALTER COLUMN tenantId UNIQUEIDENTIFIER NULL;
END;
GO

IF OBJECT_ID(N'dbo.Donations', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Donations (
    donationId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    tenantId UNIQUEIDENTIFIER NOT NULL,
    amountMinor INT NOT NULL,
    currency CHAR(3) NOT NULL,
    donorEmail NVARCHAR(320) NULL,
    status NVARCHAR(20) NOT NULL,
    stripePaymentIntentId NVARCHAR(255) NULL,
    stripeEventId NVARCHAR(255) NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_Donations_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Donations_Tenant FOREIGN KEY (tenantId)
      REFERENCES dbo.Tenants(tenantId)
      ON DELETE CASCADE,
    CONSTRAINT CK_Donations_AmountMinor_Positive CHECK (amountMinor > 0),
    CONSTRAINT CK_Donations_Status CHECK (status IN ('Pending', 'Paid', 'Failed'))
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'UX_Donations_StripePaymentIntentId'
    AND object_id = OBJECT_ID(N'dbo.Donations')
)
BEGIN
  CREATE UNIQUE INDEX UX_Donations_StripePaymentIntentId
    ON dbo.Donations(stripePaymentIntentId)
    WHERE stripePaymentIntentId IS NOT NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'UX_Donations_StripeEventId'
    AND object_id = OBJECT_ID(N'dbo.Donations')
)
BEGIN
  CREATE UNIQUE INDEX UX_Donations_StripeEventId
    ON dbo.Donations(stripeEventId)
    WHERE stripeEventId IS NOT NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_Donations_TenantId_CreatedAt'
    AND object_id = OBJECT_ID(N'dbo.Donations')
)
BEGIN
  CREATE INDEX IX_Donations_TenantId_CreatedAt
    ON dbo.Donations(tenantId, createdAt DESC);
END;
GO
