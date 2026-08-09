ALTER TABLE "Election"
  ADD COLUMN "google_sheets_spreadsheet_id" VARCHAR(128);

CREATE INDEX "idx_election_google_sheets_spreadsheet_id"
  ON "Election"("google_sheets_spreadsheet_id")
  WHERE "google_sheets_spreadsheet_id" IS NOT NULL;
