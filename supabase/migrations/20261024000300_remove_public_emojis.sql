begin;

-- Current published and draft copy is updated only when it still matches the
-- audited value. This avoids overwriting a newer edit made from the panel.
update public.site_content
set value = 'Explorá nuestro catálogo y hacé tu pre-reserva',
    updated_at = now()
where key = 'categories_lead'
  and value = U&'Explorá nuestro catálogo y hacé tu pre-reserva \2728\FE0F';

update public.site_content_drafts
set value = 'Explorá nuestro catálogo y hacé tu pre-reserva',
    updated_at = now()
where key = 'categories_lead'
  and value = U&'Explorá nuestro catálogo y hacé tu pre-reserva \2728\FE0F';

commit;

-- Manual rollback, if explicitly required:
-- update public.site_content set value = U&'Explorá nuestro catálogo y hacé tu pre-reserva \2728\FE0F', updated_at = now()
-- where key = 'categories_lead' and value = 'Explorá nuestro catálogo y hacé tu pre-reserva';
-- update public.site_content_drafts set value = U&'Explorá nuestro catálogo y hacé tu pre-reserva \2728\FE0F', updated_at = now()
-- where key = 'categories_lead' and value = 'Explorá nuestro catálogo y hacé tu pre-reserva';
