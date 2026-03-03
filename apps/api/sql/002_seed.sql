SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [FundNest];
GO

DECLARE @LegacyTenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @LegacyAdminUserId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @PlatformAdminUserId UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555555';
DECLARE @LegacyDonationOneId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @LegacyDonationTwoId UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';

-- Remove legacy demo tenant seed data so local environments start with no tenant.
DELETE FROM dbo.Donations
WHERE donationId IN (@LegacyDonationOneId, @LegacyDonationTwoId)
   OR tenantId = @LegacyTenantId;

DELETE FROM dbo.Users
WHERE userId = @LegacyAdminUserId
   OR tenantId = @LegacyTenantId;

DELETE FROM dbo.TenantConfig
WHERE tenantId = @LegacyTenantId;

DELETE FROM dbo.Tenants
WHERE tenantId = @LegacyTenantId;

IF EXISTS (SELECT 1 FROM dbo.Users WHERE userId = @PlatformAdminUserId)
BEGIN
  UPDATE dbo.Users
  SET tenantId = NULL,
      email = N'platform@fundnest.local',
      passwordHash = N'$2a$10$tXLCcR6/hOinIKTraIxTz.jYjf//aqVnT0wSC18ec2eM1Mtr4cns.',
      role = N'platform_admin'
  WHERE userId = @PlatformAdminUserId;
END
ELSE
BEGIN
  INSERT INTO dbo.Users (userId, tenantId, email, passwordHash, role)
  VALUES (
    @PlatformAdminUserId,
    NULL,
    N'platform@fundnest.local',
    N'$2a$10$tXLCcR6/hOinIKTraIxTz.jYjf//aqVnT0wSC18ec2eM1Mtr4cns.',
    N'platform_admin'
  );
END;
GO
