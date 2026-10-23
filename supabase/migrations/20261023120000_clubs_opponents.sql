-- Opponents in the clubs table (ADR 0022). A club that is not selectable only appears in matches:
-- it has a country and may have no colors, jersey pattern, founded year or city. A NULL selectable
-- means selectable (the JSON files omit the key), so the kit data is required unless it is false.

alter table public.clubs add column selectable boolean;
alter table public.clubs add column country text;

alter table public.clubs alter column colors drop not null;
alter table public.clubs alter column jersey_pattern drop not null;
alter table public.clubs alter column founded drop not null;
alter table public.clubs alter column city drop not null;

alter table public.clubs add constraint clubs_country_format check (country ~ '^[A-Z]{2}$');
alter table public.clubs add constraint clubs_selectable_kit check (selectable is false or (colors is not null and jersey_pattern is not null and founded is not null and city is not null));
alter table public.clubs add constraint clubs_country_opponents_only check ((selectable is false) = (country is not null));
