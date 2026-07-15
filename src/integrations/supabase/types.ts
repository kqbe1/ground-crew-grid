export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      binomes: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user1_id: string
          user1_percentage: number
          user2_id: string
          user2_percentage: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user1_id: string
          user1_percentage?: number
          user2_id: string
          user2_percentage?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user1_id?: string
          user1_percentage?: number
          user2_id?: string
          user2_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "binomes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binomes_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "binomes_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_equipment: {
        Row: {
          brand: string | null
          client_site_id: string
          company_id: string
          created_at: string
          energy_type: Database["public"]["Enums"]["energy_type"]
          id: string
          last_maintenance_date: string | null
          maintenance_periodicity:
            | Database["public"]["Enums"]["maintenance_periodicity"]
            | null
          model: string | null
          name: string
          next_maintenance_date: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          client_site_id: string
          company_id: string
          created_at?: string
          energy_type?: Database["public"]["Enums"]["energy_type"]
          id?: string
          last_maintenance_date?: string | null
          maintenance_periodicity?:
            | Database["public"]["Enums"]["maintenance_periodicity"]
            | null
          model?: string | null
          name: string
          next_maintenance_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          client_site_id?: string
          company_id?: string
          created_at?: string
          energy_type?: Database["public"]["Enums"]["energy_type"]
          id?: string
          last_maintenance_date?: string | null
          maintenance_periodicity?:
            | Database["public"]["Enums"]["maintenance_periodicity"]
            | null
          model?: string | null
          name?: string
          next_maintenance_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_equipment_client_site_id_fkey"
            columns: ["client_site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sites: {
        Row: {
          address: string
          city: string | null
          client_id: string
          company_id: string
          created_at: string
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city?: string | null
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_billing: string | null
          address_intervention: string | null
          birthday: string | null
          city: string | null
          company_id: string
          contact_locataire: string | null
          contact_syndic: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes_internal: string | null
          owner_client_id: string | null
          phone: string | null
          phone_secondary: string | null
          postal_code: string | null
          region: Database["public"]["Enums"]["client_region"] | null
          syndic_keys_codes: string | null
          updated_at: string
        }
        Insert: {
          address_billing?: string | null
          address_intervention?: string | null
          birthday?: string | null
          city?: string | null
          company_id: string
          contact_locataire?: string | null
          contact_syndic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes_internal?: string | null
          owner_client_id?: string | null
          phone?: string | null
          phone_secondary?: string | null
          postal_code?: string | null
          region?: Database["public"]["Enums"]["client_region"] | null
          syndic_keys_codes?: string | null
          updated_at?: string
        }
        Update: {
          address_billing?: string | null
          address_intervention?: string | null
          birthday?: string | null
          city?: string | null
          company_id?: string
          contact_locataire?: string | null
          contact_syndic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes_internal?: string | null
          owner_client_id?: string | null
          phone?: string | null
          phone_secondary?: string | null
          postal_code?: string | null
          region?: Database["public"]["Enums"]["client_region"] | null
          syndic_keys_codes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_client_id_fkey"
            columns: ["owner_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_users: number | null
          name: string
          notes: string | null
          plan: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          subscription_end: string | null
          subscription_start: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name: string
          notes?: string | null
          plan?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name?: string
          notes?: string | null
          plan?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          subscription_end?: string | null
          subscription_start?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      intervention_sheets: {
        Row: {
          arrival_time: string | null
          billing_address: string | null
          billing_city: string | null
          billing_email: string | null
          billing_name: string | null
          billing_phone: string | null
          billing_postal_code: string | null
          billing_same_as_intervention: boolean | null
          binome_name: string | null
          binome_percentage: number | null
          checklist_results: Json | null
          client_absent: boolean
          client_address_override: string | null
          client_city_override: string | null
          client_email_override: string | null
          client_name_override: string | null
          client_phone_override: string | null
          client_postal_override: string | null
          client_present: boolean
          company_id: string
          created_at: string
          departure_time: string | null
          description: string | null
          entretien_subtype: Json | null
          entretien_type: string | null
          final_status: Database["public"]["Enums"]["task_status"]
          id: string
          internal_comment: string | null
          internal_photos: string[] | null
          is_draft: boolean
          nameplate_data: Json | null
          observations_before: string | null
          photos_after: string[] | null
          photos_before: string[] | null
          photos_nameplate: string[] | null
          sent_to_client: boolean
          signature_data: string | null
          signed_at: string | null
          status_comment: string | null
          supplies_description: string | null
          updated_at: string
          work_status_detail: string | null
          work_status_details: string[] | null
          work_status_notes: Json | null
          work_task_id: string
          worker_id: string | null
        }
        Insert: {
          arrival_time?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_same_as_intervention?: boolean | null
          binome_name?: string | null
          binome_percentage?: number | null
          checklist_results?: Json | null
          client_absent?: boolean
          client_address_override?: string | null
          client_city_override?: string | null
          client_email_override?: string | null
          client_name_override?: string | null
          client_phone_override?: string | null
          client_postal_override?: string | null
          client_present?: boolean
          company_id: string
          created_at?: string
          departure_time?: string | null
          description?: string | null
          entretien_subtype?: Json | null
          entretien_type?: string | null
          final_status?: Database["public"]["Enums"]["task_status"]
          id?: string
          internal_comment?: string | null
          internal_photos?: string[] | null
          is_draft?: boolean
          nameplate_data?: Json | null
          observations_before?: string | null
          photos_after?: string[] | null
          photos_before?: string[] | null
          photos_nameplate?: string[] | null
          sent_to_client?: boolean
          signature_data?: string | null
          signed_at?: string | null
          status_comment?: string | null
          supplies_description?: string | null
          updated_at?: string
          work_status_detail?: string | null
          work_status_details?: string[] | null
          work_status_notes?: Json | null
          work_task_id: string
          worker_id?: string | null
        }
        Update: {
          arrival_time?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_phone?: string | null
          billing_postal_code?: string | null
          billing_same_as_intervention?: boolean | null
          binome_name?: string | null
          binome_percentage?: number | null
          checklist_results?: Json | null
          client_absent?: boolean
          client_address_override?: string | null
          client_city_override?: string | null
          client_email_override?: string | null
          client_name_override?: string | null
          client_phone_override?: string | null
          client_postal_override?: string | null
          client_present?: boolean
          company_id?: string
          created_at?: string
          departure_time?: string | null
          description?: string | null
          entretien_subtype?: Json | null
          entretien_type?: string | null
          final_status?: Database["public"]["Enums"]["task_status"]
          id?: string
          internal_comment?: string | null
          internal_photos?: string[] | null
          is_draft?: boolean
          nameplate_data?: Json | null
          observations_before?: string | null
          photos_after?: string[] | null
          photos_before?: string[] | null
          photos_nameplate?: string[] | null
          sent_to_client?: boolean
          signature_data?: string | null
          signed_at?: string | null
          status_comment?: string | null
          supplies_description?: string | null
          updated_at?: string
          work_status_detail?: string | null
          work_status_details?: string[] | null
          work_status_notes?: Json | null
          work_task_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_sheets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_sheets_work_task_id_fkey"
            columns: ["work_task_id"]
            isOneToOne: false
            referencedRelation: "work_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_sheets_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_maintenance_rules: {
        Row: {
          company_id: string | null
          created_at: string
          energy_type: string
          id: string
          notes: string | null
          periodicity: string
          region: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          energy_type: string
          id?: string
          notes?: string | null
          periodicity: string
          region: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          energy_type?: string
          id?: string
          notes?: string | null
          periodicity?: string
          region?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_maintenance_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          client_id: string
          client_site_id: string | null
          company_id: string
          created_at: string
          equipment_id: string | null
          id: string
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          last_done_date: string | null
          legal_alert_years: number | null
          next_due_date: string
          notes: string | null
          periodicity: Database["public"]["Enums"]["maintenance_periodicity"]
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_site_id?: string | null
          company_id: string
          created_at?: string
          equipment_id?: string | null
          id?: string
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          last_done_date?: string | null
          legal_alert_years?: number | null
          next_due_date: string
          notes?: string | null
          periodicity?: Database["public"]["Enums"]["maintenance_periodicity"]
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_site_id?: string | null
          company_id?: string
          created_at?: string
          equipment_id?: string | null
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          last_done_date?: string | null
          legal_alert_years?: number | null
          next_due_date?: string
          notes?: string | null
          periodicity?: Database["public"]["Enums"]["maintenance_periodicity"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_client_site_id_fkey"
            columns: ["client_site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "client_equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_orders: {
        Row: {
          client_id: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          ordered_at: string | null
          part_name: string
          part_reference: string | null
          photos: string[] | null
          quantity: number
          received_at: string | null
          requested_by: string
          status: Database["public"]["Enums"]["order_status"]
          supplier: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["order_urgency"]
          work_task_id: string | null
        }
        Insert: {
          client_id?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name: string
          part_reference?: string | null
          photos?: string[] | null
          quantity?: number
          received_at?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["order_urgency"]
          work_task_id?: string | null
        }
        Update: {
          client_id?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name?: string
          part_reference?: string | null
          photos?: string[] | null
          quantity?: number
          received_at?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["order_status"]
          supplier?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["order_urgency"]
          work_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_orders_work_task_id_fkey"
            columns: ["work_task_id"]
            isOneToOne: false
            referencedRelation: "work_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_settings: {
        Row: {
          company_address: string
          company_email: string
          company_id: string
          company_name: string
          company_phone: string
          company_vat: string
          company_website: string
          created_at: string
          document_title: string
          document_type: string
          footer_text: string
          id: string
          logo_url: string | null
          primary_color: string
          show_checklist: boolean
          show_client_info: boolean
          show_client_state: boolean
          show_description: boolean
          show_horaires: boolean
          show_intervention_type: boolean
          show_photos_after: boolean
          show_photos_before: boolean
          show_signature: boolean
          show_worker_info: boolean
          text_blocks: Json
          updated_at: string
        }
        Insert: {
          company_address?: string
          company_email?: string
          company_id: string
          company_name?: string
          company_phone?: string
          company_vat?: string
          company_website?: string
          created_at?: string
          document_title?: string
          document_type?: string
          footer_text?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          show_checklist?: boolean
          show_client_info?: boolean
          show_client_state?: boolean
          show_description?: boolean
          show_horaires?: boolean
          show_intervention_type?: boolean
          show_photos_after?: boolean
          show_photos_before?: boolean
          show_signature?: boolean
          show_worker_info?: boolean
          text_blocks?: Json
          updated_at?: string
        }
        Update: {
          company_address?: string
          company_email?: string
          company_id?: string
          company_name?: string
          company_phone?: string
          company_vat?: string
          company_website?: string
          created_at?: string
          document_title?: string
          document_type?: string
          footer_text?: string
          id?: string
          logo_url?: string | null
          primary_color?: string
          show_checklist?: boolean
          show_client_info?: boolean
          show_client_state?: boolean
          show_description?: boolean
          show_horaires?: boolean
          show_intervention_type?: boolean
          show_photos_after?: boolean
          show_photos_before?: boolean
          show_signature?: boolean
          show_worker_info?: boolean
          text_blocks?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_create_devis: boolean
          company_id: string | null
          created_at: string
          display_order: number
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
          worker_level: Database["public"]["Enums"]["worker_level"] | null
        }
        Insert: {
          avatar_url?: string | null
          can_create_devis?: boolean
          company_id?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          worker_level?: Database["public"]["Enums"]["worker_level"] | null
        }
        Update: {
          avatar_url?: string | null
          can_create_devis?: boolean
          company_id?: string | null
          created_at?: string
          display_order?: number
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
          worker_level?: Database["public"]["Enums"]["worker_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_postal_code: string | null
          billing_same_as_intervention: boolean
          checklist_data: Json
          client_address: string | null
          client_city: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_postal_code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          existing_installation_complete: boolean
          existing_installation_remove: boolean
          id: string
          installation_type: Database["public"]["Enums"]["installation_type"]
          internal_comments: Json
          is_urgent: boolean
          photos: Json
          plan_photos: Json
          rooms_data: Json
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          voice_notes: Json
          work_description: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          billing_same_as_intervention?: boolean
          checklist_data?: Json
          client_address?: string | null
          client_city?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_postal_code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          existing_installation_complete?: boolean
          existing_installation_remove?: boolean
          id?: string
          installation_type?: Database["public"]["Enums"]["installation_type"]
          internal_comments?: Json
          is_urgent?: boolean
          photos?: Json
          plan_photos?: Json
          rooms_data?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          voice_notes?: Json
          work_description?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_postal_code?: string | null
          billing_same_as_intervention?: boolean
          checklist_data?: Json
          client_address?: string | null
          client_city?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_postal_code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          existing_installation_complete?: boolean
          existing_installation_remove?: boolean
          id?: string
          installation_type?: Database["public"]["Enums"]["installation_type"]
          internal_comments?: Json
          is_urgent?: boolean
          photos?: Json
          plan_photos?: Json
          rooms_data?: Json
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          voice_notes?: Json
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_binomes: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_binomes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          checklist: Json | null
          company_id: string
          created_at: string
          created_by: string | null
          default_duration_minutes: number
          description: string | null
          id: string
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          name: string
          updated_at: string
        }
        Insert: {
          checklist?: Json | null
          company_id: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          description?: string | null
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          name: string
          updated_at?: string
        }
        Update: {
          checklist?: Json | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          description?: string | null
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_tasks: {
        Row: {
          assigned_to: string | null
          binome_id: string | null
          client_id: string | null
          client_site_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          equipment_id: string | null
          id: string
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          material_needed: string | null
          memo_secretariat: string | null
          scheduled_date: string
          second_assigned_to: string | null
          start_time: string
          status: Database["public"]["Enums"]["task_status"]
          template_id: string | null
          title: string
          updated_at: string
          wait_reason: string | null
        }
        Insert: {
          assigned_to?: string | null
          binome_id?: string | null
          client_id?: string | null
          client_site_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          equipment_id?: string | null
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          material_needed?: string | null
          memo_secretariat?: string | null
          scheduled_date: string
          second_assigned_to?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          wait_reason?: string | null
        }
        Update: {
          assigned_to?: string | null
          binome_id?: string | null
          client_id?: string | null
          client_site_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          equipment_id?: string | null
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          material_needed?: string | null
          memo_secretariat?: string | null
          scheduled_date?: string
          second_assigned_to?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          wait_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_binome_id_fkey"
            columns: ["binome_id"]
            isOneToOne: false
            referencedRelation: "task_binomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_client_site_id_fkey"
            columns: ["client_site_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "client_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_second_assigned_to_fkey"
            columns: ["second_assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_clients_safe: {
        Args: never
        Returns: {
          address_intervention: string
          city: string
          email: string
          id: string
          name: string
          phone: string
          postal_code: string
        }[]
      }
      get_my_company_full: {
        Args: never
        Returns: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_users: number | null
          name: string
          notes: string | null
          plan: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          subscription_end: string | null
          subscription_start: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_security_definer_violations: {
        Args: never
        Returns: {
          arguments: string
          callable_by: string
          function_name: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "ouvrier" | "super_admin" | "bureau"
      client_region: "bruxelles" | "wallonie" | "flandre"
      energy_type:
        | "gaz"
        | "mazout"
        | "pellets"
        | "electricite"
        | "clim"
        | "vmc"
        | "autre"
      installation_type:
        | "chaudiere"
        | "climatisation"
        | "vmc"
        | "salle_de_bain"
        | "autre"
      intervention_type:
        | "entretien_gaz"
        | "entretien_mazout"
        | "entretien_pellets"
        | "entretien_clim"
        | "entretien_vmc"
        | "depannage"
        | "installation"
        | "remplacement"
        | "rdv_divers"
        | "autre"
      maintenance_periodicity:
        | "mensuel"
        | "trimestriel"
        | "semestriel"
        | "annuel"
        | "bisannuel"
        | "triennal"
      order_status: "demandee" | "commandee" | "recue" | "cloturee"
      order_urgency: "normal" | "urgent" | "critique"
      quote_status:
        | "en_attente"
        | "dossier_en_cours"
        | "en_commande"
        | "sav"
        | "cloture"
      task_status:
        | "planifie"
        | "termine"
        | "a_replanifier"
        | "piece_a_commander"
        | "sav"
      worker_level: "T0" | "T1" | "T2" | "T3" | "T4" | "T5"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "ouvrier", "super_admin", "bureau"],
      client_region: ["bruxelles", "wallonie", "flandre"],
      energy_type: [
        "gaz",
        "mazout",
        "pellets",
        "electricite",
        "clim",
        "vmc",
        "autre",
      ],
      installation_type: [
        "chaudiere",
        "climatisation",
        "vmc",
        "salle_de_bain",
        "autre",
      ],
      intervention_type: [
        "entretien_gaz",
        "entretien_mazout",
        "entretien_pellets",
        "entretien_clim",
        "entretien_vmc",
        "depannage",
        "installation",
        "remplacement",
        "rdv_divers",
        "autre",
      ],
      maintenance_periodicity: [
        "mensuel",
        "trimestriel",
        "semestriel",
        "annuel",
        "bisannuel",
        "triennal",
      ],
      order_status: ["demandee", "commandee", "recue", "cloturee"],
      order_urgency: ["normal", "urgent", "critique"],
      quote_status: [
        "en_attente",
        "dossier_en_cours",
        "en_commande",
        "sav",
        "cloture",
      ],
      task_status: [
        "planifie",
        "termine",
        "a_replanifier",
        "piece_a_commander",
        "sav",
      ],
      worker_level: ["T0", "T1", "T2", "T3", "T4", "T5"],
    },
  },
} as const
