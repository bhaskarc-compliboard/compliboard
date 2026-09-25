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
          agency_type: string | null
          contact_email: string | null
          created_at: string
          id: string
          industries: string[]
          jurisdiction_city: string | null
          jurisdiction_county: string | null
          jurisdiction_level: Database["public"]["Enums"]["jurisdiction_layer"]
          jurisdiction_state: string | null
          name: string
          notes: string | null
          phone: string | null
          review_interval: string | null
          short_name: string
          updated_at: string
          url: string | null
        }
        Insert: {
          address?: string | null
          agency_type?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          industries?: string[]
          jurisdiction_city?: string | null
          jurisdiction_county?: string | null
          jurisdiction_level: Database["public"]["Enums"]["jurisdiction_layer"]
          jurisdiction_state?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          review_interval?: string | null
          short_name: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          address?: string | null
          agency_type?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          industries?: string[]
          jurisdiction_city?: string | null
          jurisdiction_county?: string | null
          jurisdiction_level?: Database["public"]["Enums"]["jurisdiction_layer"]
          jurisdiction_state?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          review_interval?: string | null
          short_name?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      ai_calls: {
        Row: {
          company_id: string | null
          cost_usd: number | null
          created_at: string
          effort: string | null
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          price_input_per_m: number | null
          price_output_per_m: number | null
          price_per_search: number | null
          searches: number
          task: string
          wall_ms: number
        }
        Insert: {
          company_id?: string | null
          cost_usd?: number | null
          created_at?: string
          effort?: string | null
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          price_input_per_m?: number | null
          price_output_per_m?: number | null
          price_per_search?: number | null
          searches?: number
          task: string
          wall_ms?: number
        }
        Update: {
          company_id?: string | null
          cost_usd?: number | null
          created_at?: string
          effort?: string | null
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          price_input_per_m?: number | null
          price_output_per_m?: number | null
          price_per_search?: number | null
          searches?: number
          task?: string
          wall_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          document_id: string | null
          due_date: string
          entity_id: string | null
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
          document_id?: string | null
          due_date: string
          entity_id?: string | null
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
          document_id?: string | null
          due_date?: string
          entity_id?: string | null
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
          {
            foreignKeyName: "calendar_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "calendar_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          agency_name: string | null
          category: Database["public"]["Enums"]["checklist_item_category"]
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
          origin: string | null
          parent_item_index: number | null
          pre_completed: boolean | null
          providers: Json | null
          recommended_by: string | null
          required_by: string | null
          search_hint: string | null
          sort_order: number | null
          source: string | null
          source_title: string | null
          source_url: string | null
          time_estimate: string | null
          what_you_need: string | null
          why: string | null
        }
        Insert: {
          agency_name?: string | null
          category: Database["public"]["Enums"]["checklist_item_category"]
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
          origin?: string | null
          parent_item_index?: number | null
          pre_completed?: boolean | null
          providers?: Json | null
          recommended_by?: string | null
          required_by?: string | null
          search_hint?: string | null
          sort_order?: number | null
          source?: string | null
          source_title?: string | null
          source_url?: string | null
          time_estimate?: string | null
          what_you_need?: string | null
          why?: string | null
        }
        Update: {
          agency_name?: string | null
          category?: Database["public"]["Enums"]["checklist_item_category"]
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
          origin?: string | null
          parent_item_index?: number | null
          pre_completed?: boolean | null
          providers?: Json | null
          recommended_by?: string | null
          required_by?: string | null
          search_hint?: string | null
          sort_order?: number | null
          source?: string | null
          source_title?: string | null
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
          from_topic_id: string | null
          id: string
          question: string
          research_answer: string | null
          research_sources: Json | null
          safety_alert: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          converted_to_checklist_id?: string | null
          created_at?: string | null
          from_topic_id?: string | null
          id?: string
          question: string
          research_answer?: string | null
          research_sources?: Json | null
          safety_alert?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          converted_to_checklist_id?: string | null
          created_at?: string | null
          from_topic_id?: string | null
          id?: string
          question?: string
          research_answer?: string | null
          research_sources?: Json | null
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
          {
            foreignKeyName: "checklists_from_topic_fk"
            columns: ["from_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
          employee_count: number | null
          extra_profile: Json | null
          id: string
          industry: string | null
          name: string
          obligations_computed_at: string | null
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
          employee_count?: number | null
          extra_profile?: Json | null
          id?: string
          industry?: string | null
          name: string
          obligations_computed_at?: string | null
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
          employee_count?: number | null
          extra_profile?: Json | null
          id?: string
          industry?: string | null
          name?: string
          obligations_computed_at?: string | null
          pre_completed_items?: Json | null
          scan_result?: Json | null
          state?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      company_chemicals: {
        Row: {
          basis: string | null
          cas_number: string | null
          company_id: string
          confidence: Database["public"]["Enums"]["switch_confidence"] | null
          created_at: string
          determined_at: string | null
          entity_id: string
          expires_at: string | null
          id: string
          max_quantity: number | null
          physical_state: Database["public"]["Enums"]["chemical_state"] | null
          source: Database["public"]["Enums"]["switch_value_source"] | null
          substance_name: string
          unit: Database["public"]["Enums"]["chemical_unit"] | null
          updated_at: string
          user_locked: boolean
        }
        Insert: {
          basis?: string | null
          cas_number?: string | null
          company_id: string
          confidence?: Database["public"]["Enums"]["switch_confidence"] | null
          created_at?: string
          determined_at?: string | null
          entity_id: string
          expires_at?: string | null
          id?: string
          max_quantity?: number | null
          physical_state?: Database["public"]["Enums"]["chemical_state"] | null
          source?: Database["public"]["Enums"]["switch_value_source"] | null
          substance_name: string
          unit?: Database["public"]["Enums"]["chemical_unit"] | null
          updated_at?: string
          user_locked?: boolean
        }
        Update: {
          basis?: string | null
          cas_number?: string | null
          company_id?: string
          confidence?: Database["public"]["Enums"]["switch_confidence"] | null
          created_at?: string
          determined_at?: string | null
          entity_id?: string
          expires_at?: string | null
          id?: string
          max_quantity?: number | null
          physical_state?: Database["public"]["Enums"]["chemical_state"] | null
          source?: Database["public"]["Enums"]["switch_value_source"] | null
          substance_name?: string
          unit?: Database["public"]["Enums"]["chemical_unit"] | null
          updated_at?: string
          user_locked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_chemicals_cas_number_fkey"
            columns: ["cas_number"]
            isOneToOne: false
            referencedRelation: "regulated_substances"
            referencedColumns: ["cas_number"]
          },
          {
            foreignKeyName: "company_chemicals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_chemicals_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      company_folders: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          section: Database["public"]["Enums"]["folder_section"]
          sort_order: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          section?: Database["public"]["Enums"]["folder_section"]
          sort_order?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          section?: Database["public"]["Enums"]["folder_section"]
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
      company_labels: {
        Row: {
          company_id: string
          created_at: string
          id: string
          kind: string
          label: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          kind: string
          label: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_switches: {
        Row: {
          basis: Json | null
          company_id: string
          confidence: Database["public"]["Enums"]["switch_confidence"] | null
          created_at: string
          determined_at: string | null
          determined_from: string | null
          entity_id: string | null
          evidence_class: Database["public"]["Enums"]["evidence_class"] | null
          expires_at: string | null
          id: string
          scope: Database["public"]["Enums"]["switch_scope"]
          source: Database["public"]["Enums"]["switch_value_source"] | null
          state: Database["public"]["Enums"]["switch_state"]
          switch_id: string
          updated_at: string
          user_locked: boolean
          value: string | null
        }
        Insert: {
          basis?: Json | null
          company_id: string
          confidence?: Database["public"]["Enums"]["switch_confidence"] | null
          created_at?: string
          determined_at?: string | null
          determined_from?: string | null
          entity_id?: string | null
          evidence_class?: Database["public"]["Enums"]["evidence_class"] | null
          expires_at?: string | null
          id?: string
          scope: Database["public"]["Enums"]["switch_scope"]
          source?: Database["public"]["Enums"]["switch_value_source"] | null
          state?: Database["public"]["Enums"]["switch_state"]
          switch_id: string
          updated_at?: string
          user_locked?: boolean
          value?: string | null
        }
        Update: {
          basis?: Json | null
          company_id?: string
          confidence?: Database["public"]["Enums"]["switch_confidence"] | null
          created_at?: string
          determined_at?: string | null
          determined_from?: string | null
          entity_id?: string | null
          evidence_class?: Database["public"]["Enums"]["evidence_class"] | null
          expires_at?: string | null
          id?: string
          scope?: Database["public"]["Enums"]["switch_scope"]
          source?: Database["public"]["Enums"]["switch_value_source"] | null
          state?: Database["public"]["Enums"]["switch_state"]
          switch_id?: string
          updated_at?: string
          user_locked?: boolean
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_switches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_switches_determination_fkey"
            columns: ["determined_from", "evidence_class"]
            isOneToOne: false
            referencedRelation: "switch_determinations"
            referencedColumns: ["id", "evidence_class"]
          },
          {
            foreignKeyName: "company_switches_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_switches_switch_scope_fkey"
            columns: ["switch_id", "scope"]
            isOneToOne: false
            referencedRelation: "switches"
            referencedColumns: ["id", "scope"]
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
            referencedRelation: "obligation_evidence_state"
            referencedColumns: ["obligation_id"]
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
      critic_findings: {
        Row: {
          because: string | null
          company_id: string
          created_at: string
          disposition: Database["public"]["Enums"]["critic_disposition"]
          finding: string
          id: string
          item: string | null
          question_no: number
          quote: string
          review_id: string
          severity: Database["public"]["Enums"]["critic_severity"]
        }
        Insert: {
          because?: string | null
          company_id: string
          created_at?: string
          disposition: Database["public"]["Enums"]["critic_disposition"]
          finding: string
          id?: string
          item?: string | null
          question_no: number
          quote: string
          review_id: string
          severity: Database["public"]["Enums"]["critic_severity"]
        }
        Update: {
          because?: string | null
          company_id?: string
          created_at?: string
          disposition?: Database["public"]["Enums"]["critic_disposition"]
          finding?: string
          id?: string
          item?: string | null
          question_no?: number
          quote?: string
          review_id?: string
          severity?: Database["public"]["Enums"]["critic_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "critic_findings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "critic_findings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "critic_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      critic_reviews: {
        Row: {
          answer_title: string | null
          company_id: string
          complete: boolean
          created_at: string
          id: string
          question: string
          source: Database["public"]["Enums"]["critic_source"]
        }
        Insert: {
          answer_title?: string | null
          company_id: string
          complete: boolean
          created_at?: string
          id?: string
          question: string
          source: Database["public"]["Enums"]["critic_source"]
        }
        Update: {
          answer_title?: string | null
          company_id?: string
          complete?: boolean
          created_at?: string
          id?: string
          question?: string
          source?: Database["public"]["Enums"]["critic_source"]
        }
        Relationships: [
          {
            foreignKeyName: "critic_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_conditions: {
        Row: {
          company_id: string
          condition_ref: string | null
          created_at: string
          document_id: string
          evidence_expected: string | null
          id: string
          ordinal: number
          scan_id: string
          title: string
        }
        Insert: {
          company_id: string
          condition_ref?: string | null
          created_at?: string
          document_id: string
          evidence_expected?: string | null
          id?: string
          ordinal: number
          scan_id: string
          title: string
        }
        Update: {
          company_id?: string
          condition_ref?: string | null
          created_at?: string
          document_id?: string
          evidence_expected?: string | null
          id?: string
          ordinal?: number
          scan_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_conditions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_conditions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_conditions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_conditions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["scan_id"]
          },
          {
            foreignKeyName: "document_conditions_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "document_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      document_corrections: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          document_id: string
          field: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          document_id: string
          field: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          field?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_corrections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_corrections_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_deadlines: {
        Row: {
          calendar_event_id: string | null
          company_id: string
          created_at: string
          document_id: string
          due_on: string | null
          id: string
          recurs: boolean
          scan_id: string
          source_line: string | null
          title: string
        }
        Insert: {
          calendar_event_id?: string | null
          company_id: string
          created_at?: string
          document_id: string
          due_on?: string | null
          id?: string
          recurs?: boolean
          scan_id: string
          source_line?: string | null
          title: string
        }
        Update: {
          calendar_event_id?: string | null
          company_id?: string
          created_at?: string
          document_id?: string
          due_on?: string | null
          id?: string
          recurs?: boolean
          scan_id?: string
          source_line?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_deadlines_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_deadlines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_deadlines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_deadlines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_deadlines_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["scan_id"]
          },
          {
            foreignKeyName: "document_deadlines_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "document_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      document_gaps: {
        Row: {
          basis: string
          citation: string | null
          citation_url: string | null
          company_id: string
          created_at: string
          description: string | null
          dismissed_reason: string | null
          document_id: string
          draftable: boolean
          fix: string | null
          id: string
          locator: string | null
          ordinal: number
          quote: string | null
          quote_verified: boolean | null
          scan_id: string
          status: string
          title: string
        }
        Insert: {
          basis?: string
          citation?: string | null
          citation_url?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          dismissed_reason?: string | null
          document_id: string
          draftable?: boolean
          fix?: string | null
          id?: string
          locator?: string | null
          ordinal: number
          quote?: string | null
          quote_verified?: boolean | null
          scan_id: string
          status?: string
          title: string
        }
        Update: {
          basis?: string
          citation?: string | null
          citation_url?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          dismissed_reason?: string | null
          document_id?: string
          draftable?: boolean
          fix?: string | null
          id?: string
          locator?: string | null
          ordinal?: number
          quote?: string | null
          quote_verified?: boolean | null
          scan_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_gaps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_gaps_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_gaps_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_gaps_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["scan_id"]
          },
          {
            foreignKeyName: "document_gaps_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "document_scans"
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
          entity_id: string | null
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
          entity_id?: string | null
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
          entity_id?: string | null
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
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_reviews_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_reviews_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      document_scans: {
        Row: {
          agencies: Json
          ai_call_id: string | null
          cited_sources: number
          company_id: string
          confidence_notes: string | null
          could_not_read_reason: string | null
          doc_date: string | null
          doc_date_kind: string | null
          document_id: string
          effort: string | null
          entity_id: string | null
          expected_missing: Json
          freshness_note: string | null
          id: string
          is_current: boolean
          issuer: string | null
          json_parsed: boolean
          jurisdiction: Json
          kind: string | null
          model: string | null
          page_refs: Json
          prompt_sha256: string | null
          quotes_checked: number
          quotes_verified: number
          raw_text: string | null
          scanned_at: string
          searches: number | null
          significant_date: string | null
          significant_date_kind: string | null
          site_scope: string | null
          status: string | null
          subjects: Json
          summary: string | null
          title: string | null
          version_confidence: string | null
          version_of_title: string | null
        }
        Insert: {
          agencies?: Json
          ai_call_id?: string | null
          cited_sources?: number
          company_id: string
          confidence_notes?: string | null
          could_not_read_reason?: string | null
          doc_date?: string | null
          doc_date_kind?: string | null
          document_id: string
          effort?: string | null
          entity_id?: string | null
          expected_missing?: Json
          freshness_note?: string | null
          id?: string
          is_current?: boolean
          issuer?: string | null
          json_parsed?: boolean
          jurisdiction?: Json
          kind?: string | null
          model?: string | null
          page_refs?: Json
          prompt_sha256?: string | null
          quotes_checked?: number
          quotes_verified?: number
          raw_text?: string | null
          scanned_at?: string
          searches?: number | null
          significant_date?: string | null
          significant_date_kind?: string | null
          site_scope?: string | null
          status?: string | null
          subjects?: Json
          summary?: string | null
          title?: string | null
          version_confidence?: string | null
          version_of_title?: string | null
        }
        Update: {
          agencies?: Json
          ai_call_id?: string | null
          cited_sources?: number
          company_id?: string
          confidence_notes?: string | null
          could_not_read_reason?: string | null
          doc_date?: string | null
          doc_date_kind?: string | null
          document_id?: string
          effort?: string | null
          entity_id?: string | null
          expected_missing?: Json
          freshness_note?: string | null
          id?: string
          is_current?: boolean
          issuer?: string | null
          json_parsed?: boolean
          jurisdiction?: Json
          kind?: string | null
          model?: string | null
          page_refs?: Json
          prompt_sha256?: string | null
          quotes_checked?: number
          quotes_verified?: number
          raw_text?: string | null
          scanned_at?: string
          searches?: number | null
          significant_date?: string | null
          significant_date_kind?: string | null
          site_scope?: string | null
          status?: string | null
          subjects?: Json
          summary?: string | null
          title?: string | null
          version_confidence?: string | null
          version_of_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_scans_ai_call_id_fkey"
            columns: ["ai_call_id"]
            isOneToOne: false
            referencedRelation: "ai_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_scans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_scans_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_scans_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_scans_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string | null
          entity_id: string | null
          file_size: number | null
          file_type: string
          file_url: string
          folder_id: string | null
          from_topic_id: string | null
          id: string
          is_recurring: boolean | null
          latest_confirmed_at: string | null
          name: string
          recurrence_period: string | null
          source: string
          status: string
          uploaded_at: string | null
          user_id: string | null
          version_confirmed: boolean
          version_of: string | null
        }
        Insert: {
          company_id?: string | null
          entity_id?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          folder_id?: string | null
          from_topic_id?: string | null
          id?: string
          is_recurring?: boolean | null
          latest_confirmed_at?: string | null
          name: string
          recurrence_period?: string | null
          source?: string
          status?: string
          uploaded_at?: string | null
          user_id?: string | null
          version_confirmed?: boolean
          version_of?: string | null
        }
        Update: {
          company_id?: string | null
          entity_id?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          folder_id?: string | null
          from_topic_id?: string | null
          id?: string
          is_recurring?: boolean | null
          latest_confirmed_at?: string | null
          name?: string
          recurrence_period?: string | null
          source?: string
          status?: string
          uploaded_at?: string | null
          user_id?: string | null
          version_confirmed?: boolean
          version_of?: string | null
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
            foreignKeyName: "documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "company_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_from_topic_fk"
            columns: ["from_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_version_of_fkey"
            columns: ["version_of"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "documents_version_of_fkey"
            columns: ["version_of"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          county: string | null
          created_at: string
          details: Json
          entity_type: Database["public"]["Enums"]["entity_scope"]
          fire_authority: string | null
          id: string
          is_primary: boolean
          name: string
          parent_entity_id: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          county?: string | null
          created_at?: string
          details?: Json
          entity_type: Database["public"]["Enums"]["entity_scope"]
          fire_authority?: string | null
          id?: string
          is_primary?: boolean
          name: string
          parent_entity_id?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          county?: string | null
          created_at?: string
          details?: Json
          entity_type?: Database["public"]["Enums"]["entity_scope"]
          fire_authority?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          parent_entity_id?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
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
      fact_proposals: {
        Row: {
          basis: string
          company_id: string
          created_at: string
          document_id: string | null
          from_turn_id: string | null
          id: string
          locator: string | null
          proposed_value: string
          quote: string | null
          quote_verified: boolean | null
          rejected_reason: string | null
          source: string
          status: string
          switch_key: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          basis?: string
          company_id: string
          created_at?: string
          document_id?: string | null
          from_turn_id?: string | null
          id?: string
          locator?: string | null
          proposed_value: string
          quote?: string | null
          quote_verified?: boolean | null
          rejected_reason?: string | null
          source?: string
          status?: string
          switch_key: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          basis?: string
          company_id?: string
          created_at?: string
          document_id?: string | null
          from_turn_id?: string | null
          id?: string
          locator?: string | null
          proposed_value?: string
          quote?: string | null
          quote_verified?: boolean | null
          rejected_reason?: string | null
          source?: string
          status?: string
          switch_key?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_proposals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "fact_proposals_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_proposals_from_turn_id_fkey"
            columns: ["from_turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_proposals_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
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
      industry_coverage: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          industry: string
          jurisdiction_state: string | null
          last_verified_at: string | null
          notes: string | null
          row_count: number
          status: Database["public"]["Enums"]["coverage_status"]
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          industry: string
          jurisdiction_state?: string | null
          last_verified_at?: string | null
          notes?: string | null
          row_count?: number
          status?: Database["public"]["Enums"]["coverage_status"]
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          industry?: string
          jurisdiction_state?: string | null
          last_verified_at?: string | null
          notes?: string | null
          row_count?: number
          status?: Database["public"]["Enums"]["coverage_status"]
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industry_coverage_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          counts: Json
          errors: Json
          finished_at: string | null
          id: string
          job: string
          ok: boolean | null
          started_at: string
        }
        Insert: {
          counts?: Json
          errors?: Json
          finished_at?: string | null
          id?: string
          job: string
          ok?: boolean | null
          started_at?: string
        }
        Update: {
          counts?: Json
          errors?: Json
          finished_at?: string | null
          id?: string
          job?: string
          ok?: boolean | null
          started_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          cancel_requested: boolean
          company_id: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          job_type: Database["public"]["Enums"]["job_type"]
          max_attempts: number
          payload: Json
          progress_message: string | null
          response_message: string | null
          result: Json | null
          scheduled_for: string
          serialization_key: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          cancel_requested?: boolean
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["job_type"]
          max_attempts?: number
          payload?: Json
          progress_message?: string | null
          response_message?: string | null
          result?: Json | null
          scheduled_for?: string
          serialization_key: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          cancel_requested?: boolean
          company_id?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          max_attempts?: number
          payload?: Json
          progress_message?: string | null
          response_message?: string | null
          result?: Json | null
          scheduled_for?: string
          serialization_key?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      library_candidates: {
        Row: {
          agency_guess: string | null
          citation_guess: string | null
          created_at: string
          first_seen_at: string
          id: string
          industry: string
          jurisdiction_state: string | null
          last_seen_at: string
          normalized_name: string
          operator_feedback: string | null
          promoted_to_requirement_id: string | null
          raw_name: string
          status: string
          times_seen: number
          updated_at: string
        }
        Insert: {
          agency_guess?: string | null
          citation_guess?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          industry: string
          jurisdiction_state?: string | null
          last_seen_at?: string
          normalized_name: string
          operator_feedback?: string | null
          promoted_to_requirement_id?: string | null
          raw_name: string
          status?: string
          times_seen?: number
          updated_at?: string
        }
        Update: {
          agency_guess?: string | null
          citation_guess?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          industry?: string
          jurisdiction_state?: string | null
          last_seen_at?: string
          normalized_name?: string
          operator_feedback?: string | null
          promoted_to_requirement_id?: string | null
          raw_name?: string
          status?: string
          times_seen?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_candidates_promoted_to_requirement_id_fkey"
            columns: ["promoted_to_requirement_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_evidence: {
        Row: {
          added_at: string
          added_by: string | null
          assessed_at: string | null
          assessed_by: string | null
          company_id: string
          contribution: Database["public"]["Enums"]["evidence_contribution"]
          document_id: string | null
          entity_id: string | null
          id: string
          match_confidence: string | null
          match_rationale: string | null
          matched_by: Database["public"]["Enums"]["evidence_source"]
          obligation_id: string
          status: string | null
          superseded_by: string | null
          superseded_reason: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          assessed_at?: string | null
          assessed_by?: string | null
          company_id: string
          contribution?: Database["public"]["Enums"]["evidence_contribution"]
          document_id?: string | null
          entity_id?: string | null
          id?: string
          match_confidence?: string | null
          match_rationale?: string | null
          matched_by: Database["public"]["Enums"]["evidence_source"]
          obligation_id: string
          status?: string | null
          superseded_by?: string | null
          superseded_reason?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          assessed_at?: string | null
          assessed_by?: string | null
          company_id?: string
          contribution?: Database["public"]["Enums"]["evidence_contribution"]
          document_id?: string | null
          entity_id?: string | null
          id?: string
          match_confidence?: string | null
          match_rationale?: string | null
          matched_by?: Database["public"]["Enums"]["evidence_source"]
          obligation_id?: string
          status?: string | null
          superseded_by?: string | null
          superseded_reason?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obligation_evidence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "obligation_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_evidence_document_same_company"
            columns: ["document_id", "company_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id", "company_id"]
          },
          {
            foreignKeyName: "obligation_evidence_document_same_company"
            columns: ["document_id", "company_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "obligation_evidence_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_evidence_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligation_evidence_state"
            referencedColumns: ["obligation_id"]
          },
          {
            foreignKeyName: "obligation_evidence_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_evidence_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "obligation_evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          applicable_from: string
          applicable_to: string | null
          company_id: string
          created_at: string
          determined_by: Json
          due_date: string | null
          entity_id: string | null
          id: string
          last_verified_at: string | null
          notes: string | null
          requirement_template_id: string
          resolution_rationale: string | null
          resolved_by: string
          status: Database["public"]["Enums"]["obligation_status"]
          updated_at: string
        }
        Insert: {
          applicable_from?: string
          applicable_to?: string | null
          company_id: string
          created_at?: string
          determined_by?: Json
          due_date?: string | null
          entity_id?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          requirement_template_id: string
          resolution_rationale?: string | null
          resolved_by?: string
          status?: Database["public"]["Enums"]["obligation_status"]
          updated_at?: string
        }
        Update: {
          applicable_from?: string
          applicable_to?: string | null
          company_id?: string
          created_at?: string
          determined_by?: Json
          due_date?: string | null
          entity_id?: string | null
          id?: string
          last_verified_at?: string | null
          notes?: string | null
          requirement_template_id?: string
          resolution_rationale?: string | null
          resolved_by?: string
          status?: Database["public"]["Enums"]["obligation_status"]
          updated_at?: string
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
      regulated_substances: {
        Row: {
          cas_number: string
          cercla_rq_lb: number | null
          created_at: string
          ehs_tpq_lb: number | null
          is_dea_list_i: boolean
          is_ehs: boolean
          is_psm_listed: boolean
          is_rmp_listed: boolean
          is_tri_listed: boolean
          name: string
          psm_threshold_lb: number | null
          rmp_threshold_lb: number | null
          source_checked_at: string | null
          source_list: string | null
          source_url: string | null
          synonyms: string[]
          tri_manufacture_lb: number | null
          tri_otherwise_used_lb: number | null
          updated_at: string
        }
        Insert: {
          cas_number: string
          cercla_rq_lb?: number | null
          created_at?: string
          ehs_tpq_lb?: number | null
          is_dea_list_i?: boolean
          is_ehs?: boolean
          is_psm_listed?: boolean
          is_rmp_listed?: boolean
          is_tri_listed?: boolean
          name: string
          psm_threshold_lb?: number | null
          rmp_threshold_lb?: number | null
          source_checked_at?: string | null
          source_list?: string | null
          source_url?: string | null
          synonyms?: string[]
          tri_manufacture_lb?: number | null
          tri_otherwise_used_lb?: number | null
          updated_at?: string
        }
        Update: {
          cas_number?: string
          cercla_rq_lb?: number | null
          created_at?: string
          ehs_tpq_lb?: number | null
          is_dea_list_i?: boolean
          is_ehs?: boolean
          is_psm_listed?: boolean
          is_rmp_listed?: boolean
          is_tri_listed?: boolean
          name?: string
          psm_threshold_lb?: number | null
          rmp_threshold_lb?: number | null
          source_checked_at?: string | null
          source_list?: string | null
          source_url?: string | null
          synonyms?: string[]
          tri_manufacture_lb?: number | null
          tri_otherwise_used_lb?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      requirement_templates: {
        Row: {
          agency_id: string | null
          applies: Database["public"]["Enums"]["applies_mode"]
          applies_expression: Json | null
          cadence: string | null
          cadence_anchor: string | null
          cadence_type: string | null
          category: string | null
          citation: string | null
          citation_federal_analogue: string | null
          citation_quote: string | null
          citation_url: string | null
          created_at: string
          effective_from: string | null
          effective_to: string | null
          entity_type: Database["public"]["Enums"]["entity_scope"]
          evidence_description: string | null
          evidence_types: string[]
          fails_if: string | null
          generated_by: Database["public"]["Enums"]["generated_by"]
          id: string
          industries: string[]
          is_determination: boolean
          jurisdiction_city: string | null
          jurisdiction_county: string | null
          jurisdiction_layer:
            | Database["public"]["Enums"]["jurisdiction_layer"]
            | null
          jurisdiction_state: string | null
          priority: Database["public"]["Enums"]["requirement_priority"]
          produces_switch: string | null
          requirement_name: string
          scope_rules: string | null
          secondary_agency_ids: string[]
          source_checked_at: string | null
          source_type: Database["public"]["Enums"]["requirement_source_type"]
          split_from_id: string | null
          status: Database["public"]["Enums"]["verification_status"]
          supersedes_id: string | null
          trigger_condition: string | null
          trigger_plain: string | null
          updated_at: string
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          agency_id?: string | null
          applies?: Database["public"]["Enums"]["applies_mode"]
          applies_expression?: Json | null
          cadence?: string | null
          cadence_anchor?: string | null
          cadence_type?: string | null
          category?: string | null
          citation?: string | null
          citation_federal_analogue?: string | null
          citation_quote?: string | null
          citation_url?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          entity_type?: Database["public"]["Enums"]["entity_scope"]
          evidence_description?: string | null
          evidence_types?: string[]
          fails_if?: string | null
          generated_by?: Database["public"]["Enums"]["generated_by"]
          id?: string
          industries?: string[]
          is_determination?: boolean
          jurisdiction_city?: string | null
          jurisdiction_county?: string | null
          jurisdiction_layer?:
            | Database["public"]["Enums"]["jurisdiction_layer"]
            | null
          jurisdiction_state?: string | null
          priority?: Database["public"]["Enums"]["requirement_priority"]
          produces_switch?: string | null
          requirement_name: string
          scope_rules?: string | null
          secondary_agency_ids?: string[]
          source_checked_at?: string | null
          source_type?: Database["public"]["Enums"]["requirement_source_type"]
          split_from_id?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          supersedes_id?: string | null
          trigger_condition?: string | null
          trigger_plain?: string | null
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          agency_id?: string | null
          applies?: Database["public"]["Enums"]["applies_mode"]
          applies_expression?: Json | null
          cadence?: string | null
          cadence_anchor?: string | null
          cadence_type?: string | null
          category?: string | null
          citation?: string | null
          citation_federal_analogue?: string | null
          citation_quote?: string | null
          citation_url?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          entity_type?: Database["public"]["Enums"]["entity_scope"]
          evidence_description?: string | null
          evidence_types?: string[]
          fails_if?: string | null
          generated_by?: Database["public"]["Enums"]["generated_by"]
          id?: string
          industries?: string[]
          is_determination?: boolean
          jurisdiction_city?: string | null
          jurisdiction_county?: string | null
          jurisdiction_layer?:
            | Database["public"]["Enums"]["jurisdiction_layer"]
            | null
          jurisdiction_state?: string | null
          priority?: Database["public"]["Enums"]["requirement_priority"]
          produces_switch?: string | null
          requirement_name?: string
          scope_rules?: string | null
          secondary_agency_ids?: string[]
          source_checked_at?: string | null
          source_type?: Database["public"]["Enums"]["requirement_source_type"]
          split_from_id?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          supersedes_id?: string | null
          trigger_condition?: string | null
          trigger_plain?: string | null
          updated_at?: string
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "requirement_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_templates_split_from_id_fkey"
            columns: ["split_from_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_templates_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id"]
          },
        ]
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
      switch_determinations: {
        Row: {
          company_id: string
          confidence: Database["public"]["Enums"]["switch_confidence"] | null
          created_at: string
          determined_at: string
          document_id: string | null
          entity_id: string | null
          evidence_class: Database["public"]["Enums"]["evidence_class"]
          id: string
          locator: string | null
          model: string | null
          prompt_sha256: string | null
          quote: string | null
          reasoning: string | null
          source: Database["public"]["Enums"]["switch_value_source"]
          switch_id: string
          value: string | null
        }
        Insert: {
          company_id: string
          confidence?: Database["public"]["Enums"]["switch_confidence"] | null
          created_at?: string
          determined_at?: string
          document_id?: string | null
          entity_id?: string | null
          evidence_class: Database["public"]["Enums"]["evidence_class"]
          id?: string
          locator?: string | null
          model?: string | null
          prompt_sha256?: string | null
          quote?: string | null
          reasoning?: string | null
          source: Database["public"]["Enums"]["switch_value_source"]
          switch_id: string
          value?: string | null
        }
        Update: {
          company_id?: string
          confidence?: Database["public"]["Enums"]["switch_confidence"] | null
          created_at?: string
          determined_at?: string
          document_id?: string | null
          entity_id?: string | null
          evidence_class?: Database["public"]["Enums"]["evidence_class"]
          id?: string
          locator?: string | null
          model?: string | null
          prompt_sha256?: string | null
          quote?: string | null
          reasoning?: string | null
          source?: Database["public"]["Enums"]["switch_value_source"]
          switch_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "switch_determinations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "switch_determinations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "switch_determinations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "switch_determinations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "switch_determinations_switch_id_fkey"
            columns: ["switch_id"]
            isOneToOne: false
            referencedRelation: "switches"
            referencedColumns: ["id"]
          },
        ]
      }
      switches: {
        Row: {
          allowed_values: string[]
          created_at: string
          depends_on_switch: string | null
          depends_on_value: string | null
          determination_source: Database["public"]["Enums"]["switch_determination_source"]
          domain: string | null
          id: string
          jurisdiction_variant: boolean
          label: string
          notes: string | null
          question_plain: string | null
          scope: Database["public"]["Enums"]["switch_scope"]
          thresholds: number[] | null
          updated_at: string
          value_type: Database["public"]["Enums"]["switch_value_type"]
          volatility: Database["public"]["Enums"]["switch_volatility"]
        }
        Insert: {
          allowed_values?: string[]
          created_at?: string
          depends_on_switch?: string | null
          depends_on_value?: string | null
          determination_source: Database["public"]["Enums"]["switch_determination_source"]
          domain?: string | null
          id: string
          jurisdiction_variant?: boolean
          label: string
          notes?: string | null
          question_plain?: string | null
          scope: Database["public"]["Enums"]["switch_scope"]
          thresholds?: number[] | null
          updated_at?: string
          value_type: Database["public"]["Enums"]["switch_value_type"]
          volatility?: Database["public"]["Enums"]["switch_volatility"]
        }
        Update: {
          allowed_values?: string[]
          created_at?: string
          depends_on_switch?: string | null
          depends_on_value?: string | null
          determination_source?: Database["public"]["Enums"]["switch_determination_source"]
          domain?: string | null
          id?: string
          jurisdiction_variant?: boolean
          label?: string
          notes?: string | null
          question_plain?: string | null
          scope?: Database["public"]["Enums"]["switch_scope"]
          thresholds?: number[] | null
          updated_at?: string
          value_type?: Database["public"]["Enums"]["switch_value_type"]
          volatility?: Database["public"]["Enums"]["switch_volatility"]
        }
        Relationships: [
          {
            foreignKeyName: "switches_depends_on_switch_fkey"
            columns: ["depends_on_switch"]
            isOneToOne: false
            referencedRelation: "switches"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          delete_after: string | null
          extracted_at: string | null
          id: string
          idle_at: string | null
          last_turn_at: string | null
          opened_at: string
          status: Database["public"]["Enums"]["topic_status"]
          summarised_at: string | null
          summary: string | null
          summary_source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          delete_after?: string | null
          extracted_at?: string | null
          id?: string
          idle_at?: string | null
          last_turn_at?: string | null
          opened_at?: string
          status?: Database["public"]["Enums"]["topic_status"]
          summarised_at?: string | null
          summary?: string | null
          summary_source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          delete_after?: string | null
          extracted_at?: string | null
          id?: string
          idle_at?: string | null
          last_turn_at?: string | null
          opened_at?: string
          status?: Database["public"]["Enums"]["topic_status"]
          summarised_at?: string | null
          summary?: string | null
          summary_source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          company_id: string
          created_at: string
          document_id: string | null
          document_name: string | null
          id: string
          position: number
          role: string
          sources: Json | null
          stopped: boolean
          text: string
          topic_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          position: number
          role: string
          sources?: Json | null
          stopped?: boolean
          text: string
          topic_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_id?: string | null
          document_name?: string | null
          id?: string
          position?: number
          role?: string
          sources?: Json | null
          stopped?: boolean
          text?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "turns_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          checklists_created: number
          company_id: string
          created_at: string
          questions_answered: number
          updated_at: string
        }
        Insert: {
          checklists_created?: number
          company_id: string
          created_at?: string
          questions_answered?: number
          updated_at?: string
        }
        Update: {
          checklists_created?: number
          company_id?: string
          created_at?: string
          questions_answered?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      document_index_v: {
        Row: {
          agencies: Json | null
          company_id: string | null
          correction_count: number | null
          could_not_read_reason: string | null
          display_status: string | null
          doc_date: string | null
          doc_date_kind: string | null
          document_id: string | null
          document_status: string | null
          entity_id: string | null
          file_name: string | null
          folder_id: string | null
          folder_name: string | null
          issuer: string | null
          kind: string | null
          latest_confirmed_at: string | null
          open_gap_count: number | null
          scan_id: string | null
          scan_status: string | null
          scanned_at: string | null
          significant_date: string | null
          significant_date_kind: string | null
          site_name: string | null
          subjects: Json | null
          summary: string | null
          title: string | null
          uploaded_at: string | null
          version_confirmed: boolean | null
          version_of: string | null
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
          {
            foreignKeyName: "documents_version_of_fkey"
            columns: ["version_of"]
            isOneToOne: false
            referencedRelation: "document_index_v"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "documents_version_of_fkey"
            columns: ["version_of"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_evidence_state: {
        Row: {
          company_id: string | null
          contradicting_evidence: number | null
          expired_evidence: number | null
          live_evidence: number | null
          next_expiry: string | null
          obligation_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obligations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      array_is_ascending: { Args: { a: number[] }; Returns: boolean }
      auth_company_id: { Args: never; Returns: string }
      close_and_replace_obligations: {
        Args: { p_company_id: string; p_obligations: Json }
        Returns: Json
      }
      increment_usage_counter: {
        Args: { p_company_id: string; p_field: string }
        Returns: undefined
      }
      substance_inventory: {
        Args: { p_entity_id: string; p_list: string }
        Returns: boolean
      }
    }
    Enums: {
      applies_mode: "conditional" | "universal"
      checklist_item_category: "must_do" | "good_to_have"
      chemical_state: "solid" | "liquid" | "gas"
      chemical_unit: "lb" | "gal" | "ft3"
      coverage_status: "not_built" | "generated" | "verified"
      critic_disposition: "withheld" | "kept" | "counted"
      critic_severity: "blocking" | "qualifying" | "coverage"
      critic_source: "chat_checklist" | "audit"
      entity_scope:
        | "organization"
        | "site"
        | "chemical"
        | "equipment"
        | "person"
        | "product"
      evidence_class: "stated" | "declared" | "implied" | "inferred" | "absent"
      evidence_contribution:
        | "satisfies"
        | "partially_satisfies"
        | "contradicts"
        | "superseded"
      evidence_source: "user" | "document_review" | "ai_match"
      folder_section: "files" | "hr" | "log"
      generated_by: "ai" | "manual"
      job_status: "pending" | "running" | "succeeded" | "failed" | "cancelled"
      job_type:
        | "index_document"
        | "generate_library"
        | "check_library"
        | "monitor_changes"
      jurisdiction_layer: "federal" | "state" | "county" | "city" | "local"
      obligation_status:
        | "applies"
        | "does_not_apply"
        | "undetermined"
        | "unknown"
      obligation_type:
        | "permit"
        | "written_program"
        | "training"
        | "recordkeeping"
        | "monitoring"
        | "reporting"
        | "physical_control"
        | "certification"
        | "credential"
        | "fees_taxes"
      requirement_priority: "critical" | "high" | "standard"
      requirement_source_type: "statutory" | "contractual"
      switch_confidence: "high" | "medium" | "low"
      switch_determination_source:
        | "documents"
        | "profile"
        | "user_answer"
        | "computed_by_requirement"
      switch_scope: "company" | "site"
      switch_state: "known" | "unknown" | "needs_user"
      switch_value_source:
        | "ai_from_documents"
        | "ai_from_profile"
        | "user_set"
        | "computed"
      switch_value_type: "enum" | "boolean" | "number" | "text"
      switch_volatility: "static" | "annual" | "monthly"
      topic_status: "open" | "closed"
      verification_status: "generated" | "disputed" | "verified"
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
    Enums: {
      applies_mode: ["conditional", "universal"],
      checklist_item_category: ["must_do", "good_to_have"],
      chemical_state: ["solid", "liquid", "gas"],
      chemical_unit: ["lb", "gal", "ft3"],
      coverage_status: ["not_built", "generated", "verified"],
      critic_disposition: ["withheld", "kept", "counted"],
      critic_severity: ["blocking", "qualifying", "coverage"],
      critic_source: ["chat_checklist", "audit"],
      entity_scope: [
        "organization",
        "site",
        "chemical",
        "equipment",
        "person",
        "product",
      ],
      evidence_class: ["stated", "declared", "implied", "inferred", "absent"],
      evidence_contribution: [
        "satisfies",
        "partially_satisfies",
        "contradicts",
        "superseded",
      ],
      evidence_source: ["user", "document_review", "ai_match"],
      folder_section: ["files", "hr", "log"],
      generated_by: ["ai", "manual"],
      job_status: ["pending", "running", "succeeded", "failed", "cancelled"],
      job_type: [
        "index_document",
        "generate_library",
        "check_library",
        "monitor_changes",
      ],
      jurisdiction_layer: ["federal", "state", "county", "city", "local"],
      obligation_status: [
        "applies",
        "does_not_apply",
        "undetermined",
        "unknown",
      ],
      obligation_type: [
        "permit",
        "written_program",
        "training",
        "recordkeeping",
        "monitoring",
        "reporting",
        "physical_control",
        "certification",
        "credential",
        "fees_taxes",
      ],
      requirement_priority: ["critical", "high", "standard"],
      requirement_source_type: ["statutory", "contractual"],
      switch_confidence: ["high", "medium", "low"],
      switch_determination_source: [
        "documents",
        "profile",
        "user_answer",
        "computed_by_requirement",
      ],
      switch_scope: ["company", "site"],
      switch_state: ["known", "unknown", "needs_user"],
      switch_value_source: [
        "ai_from_documents",
        "ai_from_profile",
        "user_set",
        "computed",
      ],
      switch_value_type: ["enum", "boolean", "number", "text"],
      switch_volatility: ["static", "annual", "monthly"],
      topic_status: ["open", "closed"],
      verification_status: ["generated", "disputed", "verified"],
    },
  },
} as const
