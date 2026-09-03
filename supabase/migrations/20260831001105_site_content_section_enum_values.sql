-- Enum values must be committed before a later migration can use them.
-- This migration is intentionally isolated to keep the following content
-- migration transactional and safe for the existing production data.

alter type public.site_content_section add value if not exists 'specials';
alter type public.site_content_section add value if not exists 'catalog_header';
alter type public.site_content_section add value if not exists 'booking_header';
