import type { BookingConfig, ServicePackageRules } from "@/lib/booking-config";

export interface BookingConfigTreatmentRow {
  id: string;
  name: string;
  slug: string;
  selection_mode: "simple" | "closed_combo" | "combo_with_extras";
  booking_config: BookingConfig;
  config_enabled: boolean;
  price_cents: number;
  duration_minutes: number;
  is_active: boolean;
  updated_at: string;
  total_booking_count: number;
  configuration_valid: boolean;
}

export interface BookingConfigOptionRow {
  id: string;
  treatment_id: string;
  name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  display_order: number;
  is_active: boolean;
  updated_at: string;
}

export interface BookingConfigCombinationRow {
  id: string;
  treatment_id: string;
  name: string;
  description: string;
  kind: "combo" | "package";
  price_cents: number;
  duration_minutes: number;
  session_count: number;
  display_order: number;
  is_active: boolean;
  updated_at: string;
  package_rules: ServicePackageRules | null;
  included_option_ids: string[];
  addon_option_ids: string[];
}
