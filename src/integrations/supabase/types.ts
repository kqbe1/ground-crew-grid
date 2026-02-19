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
      binomes: {
        Row: {
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
        ]
      }
      client_sites: {
        Row: {
          address: string
          client_id: string
          created_at: string
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          address: string
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
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
        ]
      }
      clients: {
        Row: {
          address_billing: string | null
          address_intervention: string | null
          birthday: string | null
          contact_locataire: string | null
          contact_syndic: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes_internal: string | null
          phone: string | null
          phone_secondary: string | null
          syndic_keys_codes: string | null
          updated_at: string
        }
        Insert: {
          address_billing?: string | null
          address_intervention?: string | null
          birthday?: string | null
          contact_locataire?: string | null
          contact_syndic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes_internal?: string | null
          phone?: string | null
          phone_secondary?: string | null
          syndic_keys_codes?: string | null
          updated_at?: string
        }
        Update: {
          address_billing?: string | null
          address_intervention?: string | null
          birthday?: string | null
          contact_locataire?: string | null
          contact_syndic?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes_internal?: string | null
          phone?: string | null
          phone_secondary?: string | null
          syndic_keys_codes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      intervention_sheets: {
        Row: {
          arrival_time: string | null
          checklist_results: Json | null
          client_absent: boolean
          client_present: boolean
          created_at: string
          departure_time: string | null
          description: string | null
          final_status: Database["public"]["Enums"]["task_status"]
          id: string
          is_draft: boolean
          photos_after: string[] | null
          photos_before: string[] | null
          sent_to_client: boolean
          signature_data: string | null
          signed_at: string | null
          updated_at: string
          work_task_id: string
          worker_id: string
        }
        Insert: {
          arrival_time?: string | null
          checklist_results?: Json | null
          client_absent?: boolean
          client_present?: boolean
          created_at?: string
          departure_time?: string | null
          description?: string | null
          final_status?: Database["public"]["Enums"]["task_status"]
          id?: string
          is_draft?: boolean
          photos_after?: string[] | null
          photos_before?: string[] | null
          sent_to_client?: boolean
          signature_data?: string | null
          signed_at?: string | null
          updated_at?: string
          work_task_id: string
          worker_id: string
        }
        Update: {
          arrival_time?: string | null
          checklist_results?: Json | null
          client_absent?: boolean
          client_present?: boolean
          created_at?: string
          departure_time?: string | null
          description?: string | null
          final_status?: Database["public"]["Enums"]["task_status"]
          id?: string
          is_draft?: boolean
          photos_after?: string[] | null
          photos_before?: string[] | null
          sent_to_client?: boolean
          signature_data?: string | null
          signed_at?: string | null
          updated_at?: string
          work_task_id?: string
          worker_id?: string
        }
        Relationships: [
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
      maintenance_schedules: {
        Row: {
          client_id: string
          client_site_id: string | null
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
          created_at: string
          id: string
          notes: string | null
          ordered_at: string | null
          part_name: string
          part_reference: string | null
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
          created_at?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name: string
          part_reference?: string | null
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
          created_at?: string
          id?: string
          notes?: string | null
          ordered_at?: string | null
          part_name?: string
          part_reference?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          worker_level: Database["public"]["Enums"]["worker_level"] | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          worker_level?: Database["public"]["Enums"]["worker_level"] | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          worker_level?: Database["public"]["Enums"]["worker_level"] | null
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          checklist: Json | null
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
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number
          equipment_id: string | null
          id: string
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          material_needed: string | null
          memo_secretariat: string | null
          scheduled_date: string
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
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number
          equipment_id?: string | null
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          material_needed?: string | null
          memo_secretariat?: string | null
          scheduled_date: string
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
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number
          equipment_id?: string | null
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          material_needed?: string | null
          memo_secretariat?: string | null
          scheduled_date?: string
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
            referencedRelation: "binomes"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_secretariat: { Args: never; Returns: boolean }
      is_ouvrier: { Args: never; Returns: boolean }
      is_secretariat: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "secretariat" | "ouvrier"
      energy_type:
        | "gaz"
        | "mazout"
        | "pellets"
        | "electricite"
        | "clim"
        | "vmc"
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
      task_status:
        | "planifie"
        | "termine"
        | "a_replanifier"
        | "piece_a_commander"
      worker_level: "T0" | "T1" | "T2"
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
      app_role: ["admin", "secretariat", "ouvrier"],
      energy_type: [
        "gaz",
        "mazout",
        "pellets",
        "electricite",
        "clim",
        "vmc",
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
      task_status: [
        "planifie",
        "termine",
        "a_replanifier",
        "piece_a_commander",
      ],
      worker_level: ["T0", "T1", "T2"],
    },
  },
} as const
