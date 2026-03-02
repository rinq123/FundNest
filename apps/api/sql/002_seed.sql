SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE [FundNest];
GO

DECLARE @TenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @AdminUserId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @DonationOneId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @DonationTwoId UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';

IF EXISTS (SELECT 1 FROM dbo.Tenants WHERE tenantId = @TenantId)
BEGIN
  UPDATE dbo.Tenants
  SET name = N'Demo Charity',
      slug = N'demo-charity'
  WHERE tenantId = @TenantId;
END
ELSE
BEGIN
  INSERT INTO dbo.Tenants (tenantId, name, slug)
  VALUES (@TenantId, N'Demo Charity', N'demo-charity');
END;

IF EXISTS (SELECT 1 FROM dbo.TenantConfig WHERE tenantId = @TenantId)
BEGIN
  UPDATE dbo.TenantConfig
  SET brandColor = N'#0f5ca8',
      logoUrl = NULL,
      currency = 'GBP',
      donationPresets = N'[500,1000,2000,5000]'
  WHERE tenantId = @TenantId;
END
ELSE
BEGIN
  INSERT INTO dbo.TenantConfig (tenantId, brandColor, logoUrl, currency, donationPresets)
  VALUES (@TenantId, N'#0f5ca8', NULL, 'GBP', N'[500,1000,2000,5000]');
END;

IF EXISTS (SELECT 1 FROM dbo.Users WHERE userId = @AdminUserId)
BEGIN
  UPDATE dbo.Users
  SET tenantId = @TenantId,
      email = N'admin@democharity.local',
      passwordHash = N'$2a$10$lE/ziZmaQ8Egr.180SqJM.YnXKLuuW42BVUw5RcAckfsQkBjV73.a',
      role = N'tenant_admin'
  WHERE userId = @AdminUserId;
END
ELSE
BEGIN
  INSERT INTO dbo.Users (userId, tenantId, email, passwordHash, role)
  VALUES (
    @AdminUserId,
    @TenantId,
    N'admin@democharity.local',
    N'$2a$10$lE/ziZmaQ8Egr.180SqJM.YnXKLuuW42BVUw5RcAckfsQkBjV73.a',
    N'tenant_admin'
  );
END;

IF EXISTS (SELECT 1 FROM dbo.Donations WHERE donationId = @DonationOneId)
BEGIN
  UPDATE dbo.Donations
  SET tenantId = @TenantId,
      amountMinor = 2500,
      currency = 'GBP',
      donorEmail = N'alice@example.com',
      status = N'Paid',
      stripePaymentIntentId = N'pi_seed_paid_001',
      stripeEventId = N'evt_seed_paid_001'
  WHERE donationId = @DonationOneId;
END
ELSE
BEGIN
  INSERT INTO dbo.Donations (
    donationId,
    tenantId,
    amountMinor,
    currency,
    donorEmail,
    status,
    stripePaymentIntentId,
    stripeEventId
  )
  VALUES (
    @DonationOneId,
    @TenantId,
    2500,
    'GBP',
    N'alice@example.com',
    N'Paid',
    N'pi_seed_paid_001',
    N'evt_seed_paid_001'
  );
END;

IF EXISTS (SELECT 1 FROM dbo.Donations WHERE donationId = @DonationTwoId)
BEGIN
  UPDATE dbo.Donations
  SET tenantId = @TenantId,
      amountMinor = 1500,
      currency = 'GBP',
      donorEmail = N'bob@example.com',
      status = N'Pending',
      stripePaymentIntentId = N'pi_seed_pending_001',
      stripeEventId = NULL
  WHERE donationId = @DonationTwoId;
END
ELSE
BEGIN
  INSERT INTO dbo.Donations (
    donationId,
    tenantId,
    amountMinor,
    currency,
    donorEmail,
    status,
    stripePaymentIntentId,
    stripeEventId
  )
  VALUES (
    @DonationTwoId,
    @TenantId,
    1500,
    'GBP',
    N'bob@example.com',
    N'Pending',
    N'pi_seed_pending_001',
    NULL
  );
END;
GO
