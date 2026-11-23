# Atomic worker creation

A16: create worker and relations in one database transaction. Existing July 20 migration already restricts relation writes; A19/A20 are not new code defects. Verify deployed migration separately. Use SECURITY INVOKER, explicit staff/admin authorization and a narrow insert policy. No remote changes authorized.
