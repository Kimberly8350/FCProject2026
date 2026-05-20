export type LoadStatus = 1 | 2 | 10 | 12 | 20 | 22 | 24 | 26

export const LOAD_STATUS_LABELS: Record<number, string> = {
  1: 'Unscheduled',
  2: 'Scheduled – Not Confirmed',
  10: 'Scheduled – Confirmed',
  12: 'En Route to Terminal',
  20: 'At Terminal',
  22: 'En Route to Site',
  24: 'At Site',
  26: 'Delivered',
}

export const FUEL_CITY_SITE_IDS = [605, 606, 607, 608, 610]

// Loads are delivered in this order; these statuses lock out change requests
export const LOCKED_STATUSES = [20, 22, 24, 26]

export interface Load {
  id: string
  ce_id: number
  delivery_date: string
  customer: string
  order_number: string | null
  site_id: number
  site_name: string
  terminal_id: string | null
  terminal_name: string | null
  product_name: string
  gallons_ordered: number
  site_address: string
  city: string
  state: string
  first_name: string | null
  last_name: string | null
  start_window: string | null
  end_window: string | null
  delivery_eta: string | null
  arrived_at_rack_time: string | null
  load_status: number
  customer_id: number
  synced_at: string
}

export interface LoadSettings {
  ce_id: number
  terminal_id: string | null
  supplier_id: number | null
  supplier_number: string | null
  bio_terminal_id: string | null
  bio_supplier_id: number | null
  bio_supplier_number: string | null
  notes: string | null
  needs_review: boolean
  needs_review_notes: string | null
  updated_at: string
}

// Product names that indicate a bio/diesel load requiring the bio section
export function hasBioOrDiesel(productNames: string[]): boolean {
  return productNames.some(p =>
    /bio|diesel|dsl/i.test(p)
  )
}

export interface Site {
  site_id: number
  site_name: string
  site_address: string
  city: string
  state: string
  zip: string | null
  longitude: number | null
  latitude: number | null
  auto_diesel: boolean
  truck_diesel: boolean
  bio_tank: boolean
  auto_diesel_note: string | null
  truck_diesel_note: string | null
  bio_tank_note: string | null
}

export interface AllSite {
  site_id: number
  site_name: string
  site_address: string
  city: string
  state: string
  zip: string | null
  longitude: number | null
  latitude: number | null
  customer_group_name: string | null
}

export interface Terminal {
  terminal_id: string
  terminal_abbreviation: string | null
  terminal_name: string
  terminal_address: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  is_fuel_city: boolean
  is_custom: boolean
}

export interface Supplier {
  supplier_id: number
  supplier_name: string
  supplier_loading_number: string
}

export interface EmailNotification {
  email_id: number
  name: string
  email: string
  send: boolean
  receive: boolean
  active: boolean
}

export type ChangeRequestType =
  | 'load_before_5pm'
  | 'load_after_5pm'
  | 'load_after_midnight'
  | 'cancel'
  | 'delay'
  | 'move_up'
  | 'terminal_change'
  | 'supplier_change'
  | 'needs_review'
  | 'general_notification'

export interface LoadChangeRecord {
  id: string
  ce_id: number | null
  change_type: ChangeRequestType
  description: string | null
  old_value: string | null
  new_value: string | null
  notes: string | null
  dispatch_response: string | null
  response_received_at: string | null
  created_at: string
}

export interface Paperwork {
  id: string
  ce_id: number
  file_name: string
  storage_path: string
  uploaded_at: string
}

export interface GeneralNotification {
  id: string
  message: string
  dispatch_response: string | null
  response_received_at: string | null
  created_at: string
}

export interface ETAResult {
  terminal_eta: string | null
  site_eta: string | null
  basis: 'calculated' | 'dispatch' | 'unavailable'
}

export interface Yard {
  yard_id: number
  yard_name: string
  address: string | null
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
}

export interface Driver {
  driver_id: number
  first_name: string
  last_name: string
  yard_id: number | null
  default_start_time: string   // "06:00:00"
  active: boolean
  yard?: Yard | null
}
