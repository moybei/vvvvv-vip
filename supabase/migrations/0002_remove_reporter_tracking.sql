-- Privacy decision: don't track who reported a violation, only the report
-- itself. Drop the columns entirely rather than just hiding them in the UI.

alter table violations drop column if exists created_by_email;
alter table violations drop column if exists created_by_name;
