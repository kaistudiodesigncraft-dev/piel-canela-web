export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
}

export interface AdminSpecialtyRow {
  id: string;
  name: string;
  is_active: boolean;
}

export interface AdminProfessionalRow {
  id: string;
  specialty_id: string;
  full_name: string;
  public_name: string | null;
  is_active: boolean;
}

export interface AdminTreatmentRow {
  id: string;
  category_id: string;
  specialty_id: string;
  professional_id: string | null;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  expectations: string[];
  characteristics: string[];
  duration_minutes: number;
  buffer_minutes: number;
  start_interval_minutes: 15 | 30 | 60;
  price_cents: number;
  preparation: string | null;
  contraindications: string | null;
  image_path: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_focal_x: number | string;
  image_focal_y: number | string;
  is_active: boolean;
  display_order: number;
  future_booking_count: number;
  future_booking_count_available?: boolean;
}
