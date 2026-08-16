-- Initial approved demo content promoted to editable production records.
-- Replace copy, prices and media with client-approved content from the admin panel.

alter table public.availability_rules
  add constraint availability_rules_no_duplicates
  unique (specialty_id, weekday, start_time, end_time);

insert into public.treatments (
  id, category_id, specialty_id, name, slug, short_description, description,
  expectations, characteristics, duration_minutes, buffer_minutes, price_cents,
  preparation, contraindications, image_path, image_alt, image_focal_x,
  image_focal_y, is_active, display_order
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Limpieza facial profunda', 'limpieza-facial-profunda',
    'Una sesión de cuidado facial adaptada al estado actual de tu piel.',
    'Combina higiene, exfoliación y una selección de productos acordes a la evaluación inicial. El protocolo definitivo se conversa antes de comenzar.',
    array['Evaluación breve de la piel', 'Protocolo adaptado durante la sesión', 'Indicaciones simples para continuar el cuidado'],
    array['Evaluación inicial', 'Cuidado personalizado', 'Rutina posterior'],
    60, 15, 4200000, 'Llegá sin maquillaje intenso cuando sea posible.',
    'Si estás atravesando una irritación activa o un tratamiento dermatológico, consultá antes de reservar.',
    '/images/treatment-massage-concept.png', 'Fotografía conceptual de muestra de un tratamiento de estética', 0.44, 0.5, true, 1
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Drenaje corporal', 'drenaje-corporal',
    'Trabajo manual suave y rítmico orientado al bienestar corporal.',
    'La sesión se ajusta a tus necesidades y antecedentes. No reemplaza una evaluación médica cuando existe dolor, inflamación persistente u otra condición de salud.',
    array['Entrevista breve', 'Maniobras suaves', 'Recomendaciones posteriores'],
    array['Ritmo suave', 'Atención personalizada', 'Bienestar corporal'],
    50, 10, 3800000, 'Usá ropa cómoda y avisá si existe alguna indicación médica relevante.',
    'Requiere consulta previa ante procesos inflamatorios agudos.',
    '/images/treatment-massage-concept.png', 'Fotografía conceptual de muestra de un tratamiento corporal', 0.54, 0.5, true, 2
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'Relajación profunda', 'relajacion-profunda',
    'Un masaje de ritmo sereno para aflojar tensiones y bajar el ritmo cotidiano.',
    'Una experiencia de bienestar corporal con presión moderada y atención en las zonas que acumulan tensión. La intensidad se acuerda durante la sesión.',
    array['Presión conversada', 'Ambiente calmo', 'Cierre sin apuro'],
    array['Afloja tensiones', 'Promueve el descanso', 'Intensidad adaptable'],
    60, 15, 6500000, 'Llegá diez minutos antes para conversar tus preferencias.',
    'Consultá antes de reservar si tenés una lesión reciente.',
    '/images/treatment-massage-concept.png', 'Fotografía conceptual de muestra de un masaje de bienestar', 0.38, 0.5, true, 1
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'Masaje descontracturante', 'masaje-descontracturante',
    'Trabajo focalizado en zonas que concentran sobrecarga y tensión muscular.',
    'La intensidad y las zonas de trabajo se definen después de una conversación breve. Si existe dolor agudo, puede requerirse evaluación profesional previa.',
    array['Consulta inicial', 'Trabajo localizado', 'Presión regulable'],
    array['Enfoque localizado', 'Presión adaptable', 'Recuperación cotidiana'],
    45, 15, 5200000, 'Comentá lesiones recientes o molestias persistentes antes de comenzar.',
    'No se realiza sobre lesiones agudas sin evaluación previa.',
    '/images/treatment-massage-concept.png', 'Fotografía conceptual de muestra de un masaje corporal', 0.47, 0.5, true, 2
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'Evaluación kinésica', 'evaluacion-kinesica',
    'Una instancia profesional para comprender una molestia y definir próximos pasos.',
    'Incluye entrevista, observación funcional y orientación inicial. El alcance final depende de la situación de cada persona y no se comunica como diagnóstico web.',
    array['Entrevista profesional', 'Evaluación funcional', 'Orientación inicial'],
    array['Mirada profesional', 'Evaluación individual', 'Próximos pasos claros'],
    45, 15, 4800000, 'Traé estudios previos si resultan relevantes y usá ropa cómoda.', null,
    '/images/treatment-massage-concept.png', 'Fotografía conceptual de muestra de una evaluación profesional', 0.59, 0.5, true, 1
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'Recuperación muscular', 'recuperacion-muscular',
    'Una sesión orientada a acompañar el descanso corporal después de la actividad.',
    'Integra recursos de descarga y movilidad seleccionados a partir de una conversación inicial. No sustituye una consulta ante dolor agudo o lesión.',
    array['Revisión de necesidades', 'Trabajo corporal', 'Pautas de recuperación'],
    array['Descarga corporal', 'Movilidad suave', 'Plan personalizado'],
    50, 10, 5600000, 'Dejá pasar unos minutos después de entrenar y mantenete hidratado.',
    'Ante dolor agudo o lesión reciente, solicitá primero una evaluación.',
    '/images/treatment-massage-concept.png', 'Fotografía conceptual de muestra de un tratamiento de recuperación', 0.63, 0.5, true, 2
  )
on conflict (id) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  description = excluded.description,
  expectations = excluded.expectations,
  characteristics = excluded.characteristics,
  duration_minutes = excluded.duration_minutes,
  buffer_minutes = excluded.buffer_minutes,
  price_cents = excluded.price_cents,
  preparation = excluded.preparation,
  contraindications = excluded.contraindications,
  image_path = excluded.image_path,
  image_alt = excluded.image_alt,
  image_focal_x = excluded.image_focal_x,
  image_focal_y = excluded.image_focal_y,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

insert into public.availability_rules (
  specialty_id, weekday, start_time, end_time, slot_interval_minutes
)
select
  specialty_id,
  weekday,
  case when weekday = 6 then time '09:00' else time '09:00' end,
  case when weekday = 6 then time '14:00' else time '20:00' end,
  15
from unnest(array[
  '20000000-0000-4000-8000-000000000001'::uuid,
  '20000000-0000-4000-8000-000000000002'::uuid,
  '20000000-0000-4000-8000-000000000003'::uuid
]) as specialties(specialty_id)
cross join generate_series(1, 6) as days(weekday)
on conflict (specialty_id, weekday, start_time, end_time) do nothing;

insert into public.monthly_specials (
  id, treatment_id, title, short_description, detail, image_path, image_alt,
  image_focal_x, image_focal_y, special_price_cents, reference_price_cents,
  starts_at, ends_at, terms, is_active, display_order, created_by
)
select
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000003',
  'Pausa profunda',
  'Relajación profunda con un valor especial durante el mes.',
  'Una propuesta puntual para bajar el ritmo y liberar tensión. La promoción se aplica al seleccionar este especial.',
  '/images/treatment-massage-concept.png',
  'Fotografía conceptual de muestra del especial Pausa profunda',
  0.38, 0.5, 5500000, 6500000,
  '2026-08-01 00:00:00-03'::timestamptz,
  '2026-10-01 00:00:00-03'::timestamptz,
  'Sujeto a disponibilidad. Requiere confirmación de seña.',
  true, 1, p.user_id
from public.profiles p
where p.is_active
order by p.created_at
limit 1
on conflict (id) do update set
  title = excluded.title,
  short_description = excluded.short_description,
  detail = excluded.detail,
  special_price_cents = excluded.special_price_cents,
  reference_price_cents = excluded.reference_price_cents,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  terms = excluded.terms,
  is_active = excluded.is_active,
  display_order = excluded.display_order;
