// FMIQ — Azure infrastructure (skeleton)
// Region pinned to North Europe (Ireland) for EU data residency. See docs/architecture-adr.md.
// Deploy: az deployment group create -g rg-fmiq -f infra/main.bicep -p env=dev

@description('Deployment environment')
@allowed(['dev', 'staging', 'prod'])
param env string = 'dev'

@description('Azure region — Ireland for data residency')
param location string = 'northeurope'

@description('Postgres admin login')
param pgAdmin string = 'fmiqadmin'

@secure()
param pgAdminPassword string

var prefix = 'fmiq-${env}'

// --- PostgreSQL Flexible Server (system of record + TimescaleDB) ---
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${prefix}-pg'
  location: location
  sku: { name: env == 'prod' ? 'Standard_D4ds_v5' : 'Standard_B2ms', tier: env == 'prod' ? 'GeneralPurpose' : 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: pgAdmin
    administratorLoginPassword: pgAdminPassword
    storage: { storageSizeGB: 128 }
    backup: { backupRetentionDays: env == 'prod' ? 35 : 7, geoRedundantBackup: env == 'prod' ? 'Enabled' : 'Disabled' }
    highAvailability: { mode: env == 'prod' ? 'ZoneRedundant' : 'Disabled' }
    network: { publicNetworkAccess: 'Disabled' } // Private Link only in non-dev; open for dev separately
  }
}

// Enable required extensions (TimescaleDB, PostGIS, pgaudit, pgcrypto)
resource pgConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: pg
  name: 'azure.extensions'
  properties: { value: 'TIMESCALEDB,POSTGIS,PGAUDIT,PGCRYPTO', source: 'user-override' }
}

// --- Key Vault (secrets, CMK) ---
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}-kv'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
  }
}

// --- Storage (documents, photos, IFC) ---
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: replace('${prefix}stor', '-', '')
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', allowBlobPublicAccess: false }
}

// --- Container Apps environment (API) + Static Web Apps (SPA) are added next ---
// --- IoT Hub / Event Hubs for sensor ingestion added in Phase 2 ---

output postgresHost string = pg.properties.fullyQualifiedDomainName
output keyVaultName string = kv.name
output storageAccount string = storage.name
