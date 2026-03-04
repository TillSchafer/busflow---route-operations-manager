-- driver_locations: stores the current GPS position of active drivers.
-- One row per user (PRIMARY KEY = user_id), upserted from the mobile app.

CREATE TABLE driver_locations (
  user_id    uuid PRIMARY KEY REFERENCES profiles(id)          ON DELETE CASCADE,
  account_id uuid NOT NULL    REFERENCES platform_accounts(id) ON DELETE CASCADE,
  full_name  text,                         -- denormalized for fast display
  lat        double precision NOT NULL,
  lon        double precision NOT NULL,
  heading    double precision,             -- 0-360 degrees, nullable
  accuracy   double precision,             -- metres
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active  boolean NOT NULL DEFAULT true
);

CREATE INDEX driver_locations_account_id_idx ON driver_locations(account_id);

-- Full replica identity so realtime payloads include the complete row on UPDATE/DELETE.
ALTER TABLE driver_locations REPLICA IDENTITY FULL;

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Any active member of the same account may read all driver locations for that account.
CREATE POLICY "account members can view driver locations"
  ON driver_locations FOR SELECT
  USING (
    account_id IN (
      SELECT account_id
      FROM   account_memberships
      WHERE  user_id = auth.uid()
        AND  status  = 'ACTIVE'
    )
  );

-- A driver may insert their own row.
CREATE POLICY "driver can insert own location"
  ON driver_locations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- A driver may update their own row (including setting is_active = false).
CREATE POLICY "driver can update own location"
  ON driver_locations FOR UPDATE
  USING   (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
