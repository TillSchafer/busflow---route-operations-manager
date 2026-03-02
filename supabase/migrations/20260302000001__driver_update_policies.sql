-- Driver update policies
-- Fahrer (VIEWER-Rolle) können ihre eigenen zugewiesenen Routen aktualisieren
-- sowie die Ist-Zeiten und Fahrgastzahlen der zugehörigen Halte eintragen.
-- Das bisherige "Dispatch or admin can write routes/stops" bleibt unverändert;
-- die neuen Policies werden per OR mit diesen verknüpft.

-- busflow_routes: Fahrer darf Status + Lifecycle-Felder der eigenen zugewiesenen Route aktualisieren
drop policy if exists "Assigned driver can update own route lifecycle" on public.busflow_routes;
create policy "Assigned driver can update own route lifecycle"
  on public.busflow_routes for update
  using (
    assigned_user_id = auth.uid()
    and public.has_account_access(account_id)
  )
  with check (
    assigned_user_id = auth.uid()
    and public.has_account_access(account_id)
  );

-- busflow_stops: Fahrer darf Ist-Zeiten + Fahrgastzahlen für Halte seiner Route aktualisieren
drop policy if exists "Assigned driver can update own stops actual data" on public.busflow_stops;
create policy "Assigned driver can update own stops actual data"
  on public.busflow_stops for update
  using (
    public.has_account_access(account_id)
    and exists (
      select 1 from public.busflow_routes r
      where r.id = busflow_stops.route_id
        and r.assigned_user_id = auth.uid()
    )
  )
  with check (
    public.has_account_access(account_id)
    and exists (
      select 1 from public.busflow_routes r
      where r.id = busflow_stops.route_id
        and r.assigned_user_id = auth.uid()
    )
  );
