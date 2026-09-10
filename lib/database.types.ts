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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          address: string | null
          agency_type: string
          created_at: string | null
          id: string
          jurisdiction: string
          name: string
          phone: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          address?: string | null
          agency_type: string
          created_at?: string | null
          id?: string
          jurisdiction: string
          name: string
          phone?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          address?: string | null
          agency_type?: string
          created_at?: string | null
          id?: string
          jurisdiction?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      audits: {
        Row: {
          company_id: string
          company_template_id: string | null
          created_at: string
          id: string
          line_items: Json
          readiness_needs_info: number
          readiness_needs_work: number
          readiness_satisfied: number
          source_name: string
          source_type: string
          standard_template_id: string | null
          uploaded_file_url: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          company_template_id?: string | null
          created_at?: string
          id?: string
          line_items?: Json
          readiness_needs_info?: number
          readiness_needs_work?: number
          readiness_satisfied?: number
          source_name: string
          source_type: string
          standard_template_id?: string | null
          uploaded_file_url?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          company_template_id?: string | null
          created_at?: string
          id?: string
          line_items?: Json
          readiness_needs_info?: number
          readiness_needs_work?: number
          readiness_satisfied?: number
          source_name?: string
          source_type?: string
          standard_template_id?: string | null
          uploaded_file_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_company_template_id_fkey"
            columns: ["company_template_id"]
            isOneToOne: false
            referencedRelation: "company_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_standard_template_id_fkey"
            columns: ["standard_template_id"]
            isOneToOne: false
            referencedRelation: "standard_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          category: string | null
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          is_recurring: boolean | null
          recurrence_period: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          is_recurring?: boolean | null
          recurrence_period?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          is_recurring?: boolean | null
          recurrence_period?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          agency_name: string | null
          category: string
          checklist_id: string | null
          clarifying_questions: Json | null
          company_id: string
          completed: boolean | null
          completed_at: string | null
          cost_note: string | null
          description: string | null
          id: string
          is_determination: boolean | null
          name: string
          parent_item_index: number | null
          pre_completed: boolean | null
          providers: Json | null
          recommended_by: string | null
          required_by: string | null
          search_hint: string | null
          sort_order: number | null
          source: string | null
          source_url: string | null
          time_estimate: string | null
          what_you_need: string | null
          why: string | null
        }
        Insert: {
          agency_name?: string | null
          category: string
          checklist_id?: string | null
          clarifying_questions?: Json | null
          company_id: string
          completed?: boolean | null
          completed_at?: string | null
          cost_note?: string | null
          description?: string | null
          id?: string
          is_determination?: boolean | null
          name: string
          parent_item_index?: number | null
          pre_completed?: boolean | null
          providers?: Json | null
          recommended_by?: string | null
          required_by?: string | null
          search_hint?: string | null
          sort_order?: number | null
          source?: string | null
          source_url?: string | null
          time_estimate?: string | null
          what_you_need?: string | null
          why?: string | null
        }
        Update: {
          agency_name?: string | null
          category?: string
          checklist_id?: string | null
          clarifying_questions?: Json | null
          company_id?: string
          completed?: boolean | null
          completed_at?: string | null
          cost_note?: string | null
          description?: string | null
          id?: string
          is_determination?: boolean | null
          name?: string
          parent_item_index?: number | null
          pre_completed?: boolean | null
          providers?: Json | null
          recommended_by?: string | null
          required_by?: string | null
          search_hint?: string | null
          sort_order?: number | null
          source?: string | null
          source_url?: string | null
          time_estimate?: string | null
          what_you_need?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          company_id: string | null
          converted_to_checklist_id: string | null
          created_at: string | null
          id: string
          question: string
          research_answer: string | null
          safety_alert: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          converted_to_checklist_id?: string | null
          created_at?: string | null
          id?: string
          question: string
          research_answer?: string | null
          safety_alert?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          converted_to_checklist_id?: string | null
          created_at?: string | null
          id?: string
          question?: string
          research_answer?: string | null
          safety_alert?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_converted_to_checklist_id_fkey"
            columns: ["converted_to_checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          chemicals: string | null
          city: string | null
          county: string | null
          created_at: string | null
          employee_count: string | null
          extra_profile: Json | null
          id: string
          industry: string | null
          name: string
          pre_completed_items: Json | null
          scan_result: Json | null
          state: string | null
          website_url: string | null
        }
        Insert: {
          chemicals?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          employee_count?: string | null
          extra_profile?: Json | null
          id?: string
          industry?: string | null
          name: string
          pre_completed_items?: Json | null
          scan_result?: Json | null
          state?: string | null
          website_url?: string | null
        }
        Update: {
          chemicals?: string | null
          city?: string | null
          county?: string | null
          created_at?: string | null
          employee_count?: string | null
          extra_profile?: Json | null
          id?: string
          industry?: string | null
          name?: string
          pre_completed_items?: Json | null
          scan_result?: Json | null
          state?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      company_folders: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          section: string
          sort_order: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          section?: string
          sort_order?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          section?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_folders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "company_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      company_templates: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          line_items: Json
          source_name: string
          uploaded_file_url: string | null
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          line_items?: Json
          source_name: string
          uploaded_file_url?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          line_items?: Json
          source_name?: string
          uploaded_file_url?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      corrections: {
        Row: {
          company_id: string | null
          correction_text: string
          created_at: string | null
          id: string
          obligation_id: string | null
          reported_by: string | null
          requirement_template_id: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          correction_text: string
          created_at?: string | null
          id?: string
          obligation_id?: string | null
          reported_by?: string | null
          requirement_template_id?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          correction_text?: string
          created_at?: string | null
          id?: string
          obligation_id?: string | null
          reported_by?: string | null
          requirement_template_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_requirement_template_id_fkey"
            columns: ["requirement_template_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reviews: {
        Row: {
          action_items: Json | null
          company_id: string | null
          coverage: string | null
          created_at: string | null
          days_until_expiry: number | null
          division_name: string | null
          document_id: string | null
          document_name: string
          document_type: string | null
          expiring_soon: boolean | null
          expiry_date: string | null
          folder_id: string | null
          folder_name: string | null
          gap_fixes: Json | null
          gaps: Json | null
          id: string
          is_current: boolean | null
          issue_date: string | null
          issued_by: string | null
          regulation_reference: string | null
          renewal_date: string | null
          summary: string | null
          user_id: string | null
        }
        Insert: {
          action_items?: Json | null
          company_id?: string | null
          coverage?: string | null
          created_at?: string | null
          days_until_expiry?: number | null
          division_name?: string | null
          document_id?: string | null
          document_name: string
          document_type?: string | null
          expiring_soon?: boolean | null
          expiry_date?: string | null
          folder_id?: string | null
          folder_name?: string | null
          gap_fixes?: Json | null
          gaps?: Json | null
          id?: string
          is_current?: boolean | null
          issue_date?: string | null
          issued_by?: string | null
          regulation_reference?: string | null
          renewal_date?: string | null
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          action_items?: Json | null
          company_id?: string | null
          coverage?: string | null
          created_at?: string | null
          days_until_expiry?: number | null
          division_name?: string | null
          document_id?: string | null
          document_name?: string
          document_type?: string | null
          expiring_soon?: boolean | null
          expiry_date?: string | null
          folder_id?: string | null
          folder_name?: string | null
          gap_fixes?: Json | null
          gaps?: Json | null
          id?: string
          is_current?: boolean | null
          issue_date?: string | null
          issued_by?: string | null
          regulation_reference?: string | null
          renewal_date?: string | null
          summary?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_reviews_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string | null
          file_size: number | null
          file_type: string
          file_url: string
          folder_id: string | null
          id: string
          is_recurring: boolean | null
          name: string
          recurrence_period: string | null
          uploaded_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          folder_id?: string | null
          id?: string
          is_recurring?: boolean | null
          name: string
          recurrence_period?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          folder_id?: string | null
          id?: string
          is_recurring?: boolean | null
          name?: string
          recurrence_period?: string | null
          uploaded_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "company_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          company_id: string
          created_at: string | null
          details: Json | null
          entity_type: string
          id: string
          name: string
          parent_entity_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          details?: Json | null
          entity_type: string
          id?: string
          name: string
          parent_entity_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          details?: Json | null
          entity_type?: string
          id?: string
          name?: string
          parent_entity_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_audits: {
        Row: {
          company_id: string
          created_at: string
          draft_policies: Json
          handbook_file_url: string
          handbook_name: string
          id: string
          missing: Json
          present: Json
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          draft_policies?: Json
          handbook_file_url: string
          handbook_name: string
          id?: string
          missing?: Json
          present?: Json
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          draft_policies?: Json
          handbook_file_url?: string
          handbook_name?: string
          id?: string
          missing?: Json
          present?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_evidence: {
        Row: {
          added_at: string | null
          added_by: string | null
          document_id: string
          id: string
          obligation_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          document_id: string
          id?: string
          obligation_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          document_id?: string
          id?: string
          obligation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligation_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_evidence_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          company_id: string
          created_at: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          last_verified_at: string | null
          notes: string | null
          requirement_template_id: string
          resolution_rationale: string | null
          resolved_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          requirement_template_id: string
          resolution_rationale?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          requirement_template_id?: string
          resolution_rationale?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obligations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_requirement_template_id_fkey"
            columns: ["requirement_template_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
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
      requirement_templates: {
        Row: {
          applies: string
          cadence: string | null
          category: string | null
          citation: string | null
          created_at: string | null
          entity_type: string
          evidence_description: string | null
          fails_if: string | null
          id: string
          industry: string
          is_determination: boolean | null
          jurisdiction_county: string | null
          jurisdiction_state: string | null
          layer: string
          priority: string | null
          requirement_name: string
          source: string | null
          status: string | null
          trigger_condition: string | null
          trigger_plain: string | null
          updated_at: string | null
        }
        Insert: {
          applies?: string
          cadence?: string | null
          category?: string | null
          citation?: string | null
          created_at?: string | null
          entity_type?: string
          evidence_description?: string | null
          fails_if?: string | null
          id?: string
          industry: string
          is_determination?: boolean | null
          jurisdiction_county?: string | null
          jurisdiction_state?: string | null
          layer?: string
          priority?: string | null
          requirement_name: string
          source?: string | null
          status?: string | null
          trigger_condition?: string | null
          trigger_plain?: string | null
          updated_at?: string | null
        }
        Update: {
          applies?: string
          cadence?: string | null
          category?: string | null
          citation?: string | null
          created_at?: string | null
          entity_type?: string
          evidence_description?: string | null
          fails_if?: string | null
          id?: string
          industry?: string
          is_determination?: boolean | null
          jurisdiction_county?: string | null
          jurisdiction_state?: string | null
          layer?: string
          priority?: string | null
          requirement_name?: string
          source?: string | null
          status?: string | null
          trigger_condition?: string | null
          trigger_plain?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      standard_templates: {
        Row: {
          created_at: string
          id: string
          line_items: Json
          source: string
          standard_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_items?: Json
          source?: string
          standard_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_items?: Json
          source?: string
          standard_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
