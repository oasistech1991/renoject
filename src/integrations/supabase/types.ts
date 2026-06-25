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
      client_profiles: {
        Row: {
          available_capital: number | null
          avatar_url: string | null
          bio: string | null
          budget_max: number | null
          budget_min: number | null
          capital_notes: string | null
          capital_updated_at: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          headline: string | null
          investor_type: string | null
          location: string | null
          preferred_areas: string[]
          preferred_deal_types: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          available_capital?: number | null
          avatar_url?: string | null
          bio?: string | null
          budget_max?: number | null
          budget_min?: number | null
          capital_notes?: string | null
          capital_updated_at?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          investor_type?: string | null
          location?: string | null
          preferred_areas?: string[]
          preferred_deal_types?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          available_capital?: number | null
          avatar_url?: string | null
          bio?: string | null
          budget_max?: number | null
          budget_min?: number | null
          capital_notes?: string | null
          capital_updated_at?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          investor_type?: string | null
          location?: string | null
          preferred_areas?: string[]
          preferred_deal_types?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          body: string | null
          client_id: string
          created_at: string
          feed_post_id: string | null
          id: string
          occurred_at: string
          subject: string | null
          team_member_id: string | null
          type: Database["public"]["Enums"]["crm_activity_type"]
        }
        Insert: {
          body?: string | null
          client_id: string
          created_at?: string
          feed_post_id?: string | null
          id?: string
          occurred_at?: string
          subject?: string | null
          team_member_id?: string | null
          type: Database["public"]["Enums"]["crm_activity_type"]
        }
        Update: {
          body?: string | null
          client_id?: string
          created_at?: string
          feed_post_id?: string | null
          id?: string
          occurred_at?: string
          subject?: string | null
          team_member_id?: string | null
          type?: Database["public"]["Enums"]["crm_activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_compliance_items: {
        Row: {
          created_at: string
          document_url: string | null
          expires_on: string | null
          id: string
          issued_on: string | null
          notes: string | null
          property_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          notes?: string | null
          property_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          notes?: string | null
          property_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_compliance_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "crm_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_meta: {
        Row: {
          client_id: string
          created_at: string
          last_contacted_at: string | null
          lifecycle_value: number
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          source: string | null
          stage: Database["public"]["Enums"]["crm_stage"]
          tags: string[]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          last_contacted_at?: string | null
          lifecycle_value?: number
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          last_contacted_at?: string | null
          lifecycle_value?: number
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      crm_contractor_meta: {
        Row: {
          default_rate: number | null
          last_used_at: string | null
          notes: string | null
          preferred: boolean | null
          rating: number | null
          total_spend: number | null
          tradesman_id: string
          updated_at: string
        }
        Insert: {
          default_rate?: number | null
          last_used_at?: string | null
          notes?: string | null
          preferred?: boolean | null
          rating?: number | null
          total_spend?: number | null
          tradesman_id: string
          updated_at?: string
        }
        Update: {
          default_rate?: number | null
          last_used_at?: string | null
          notes?: string | null
          preferred?: boolean | null
          rating?: number | null
          total_spend?: number | null
          tradesman_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contractor_meta_tradesman_id_fkey"
            columns: ["tradesman_id"]
            isOneToOne: true
            referencedRelation: "tradesmen"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_clients: {
        Row: {
          amount: number | null
          client_id: string
          created_at: string
          feed_post_id: string
          id: string
          notes: string | null
          owner_id: string | null
          probability: number
          stage: Database["public"]["Enums"]["crm_stage"]
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_id: string
          created_at?: string
          feed_post_id: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          probability?: number
          stage?: Database["public"]["Enums"]["crm_stage"]
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_id?: string
          created_at?: string
          feed_post_id?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          probability?: number
          stage?: Database["public"]["Enums"]["crm_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_clients_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_documents: {
        Row: {
          file_url: string
          id: string
          kind: string
          name: string
          property_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_url: string
          id?: string
          kind?: string
          name: string
          property_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_url?: string
          id?: string
          kind?: string
          name?: string
          property_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "crm_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          notes: string | null
          property_id: string
          receipt_url: string | null
          supplier_id: string | null
          updated_at: string
          vat_amount: number
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          property_id: string
          receipt_url?: string | null
          supplier_id?: string | null
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          property_id?: string
          receipt_url?: string | null
          supplier_id?: string | null
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "crm_properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "tradesmen"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          area_pref: string | null
          budget_max: number | null
          budget_min: number | null
          converted_client_id: string | null
          created_at: string
          email: string | null
          id: string
          interested_in: string | null
          last_contacted_at: string | null
          name: string
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          source: Database["public"]["Enums"]["crm_lead_source"] | null
          status: Database["public"]["Enums"]["crm_lead_status"] | null
          updated_at: string
        }
        Insert: {
          area_pref?: string | null
          budget_max?: number | null
          budget_min?: number | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_in?: string | null
          last_contacted_at?: string | null
          name: string
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["crm_lead_source"] | null
          status?: Database["public"]["Enums"]["crm_lead_status"] | null
          updated_at?: string
        }
        Update: {
          area_pref?: string | null
          budget_max?: number | null
          budget_min?: number | null
          converted_client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interested_in?: string | null
          last_contacted_at?: string | null
          name?: string
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["crm_lead_source"] | null
          status?: Database["public"]["Enums"]["crm_lead_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_project_tasks: {
        Row: {
          assignee_id: string | null
          contractor_id: string | null
          cost: number | null
          created_at: string
          depends_on: string | null
          duration_days: number | null
          id: string
          project_id: string
          start_date: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          contractor_id?: string | null
          cost?: number | null
          created_at?: string
          depends_on?: string | null
          duration_days?: number | null
          id?: string
          project_id: string
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          contractor_id?: string | null
          cost?: number | null
          created_at?: string
          depends_on?: string | null
          duration_days?: number | null
          id?: string
          project_id?: string
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_project_tasks_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "tradesmen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_project_tasks_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "crm_project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_projects: {
        Row: {
          actual_end: string | null
          budget: number | null
          created_at: string
          id: string
          name: string
          notes: string | null
          pm_user_id: string | null
          property_id: string
          risk: Database["public"]["Enums"]["crm_risk"] | null
          spent: number | null
          stage: Database["public"]["Enums"]["crm_project_stage"] | null
          start_date: string | null
          target_end: string | null
          type: Database["public"]["Enums"]["crm_project_type"] | null
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          budget?: number | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          pm_user_id?: string | null
          property_id: string
          risk?: Database["public"]["Enums"]["crm_risk"] | null
          spent?: number | null
          stage?: Database["public"]["Enums"]["crm_project_stage"] | null
          start_date?: string | null
          target_end?: string | null
          type?: Database["public"]["Enums"]["crm_project_type"] | null
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          budget?: number | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          pm_user_id?: string | null
          property_id?: string
          risk?: Database["public"]["Enums"]["crm_risk"] | null
          spent?: number | null
          stage?: Database["public"]["Enums"]["crm_project_stage"] | null
          start_date?: string | null
          target_end?: string | null
          type?: Database["public"]["Enums"]["crm_project_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "crm_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_properties: {
        Row: {
          address: string
          baths: number | null
          beds: number | null
          created_at: string
          current_value: number | null
          equity: number | null
          hero_image_url: string | null
          id: string
          lat: number | null
          lng: number | null
          notes: string | null
          owner_entity: string | null
          postcode: string | null
          property_type: Database["public"]["Enums"]["crm_property_type"] | null
          purchase_price: number | null
          source_post_id: string | null
          sqft: number | null
          status: Database["public"]["Enums"]["crm_property_status"] | null
          tenure: string | null
          updated_at: string
        }
        Insert: {
          address: string
          baths?: number | null
          beds?: number | null
          created_at?: string
          current_value?: number | null
          equity?: number | null
          hero_image_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          owner_entity?: string | null
          postcode?: string | null
          property_type?:
            | Database["public"]["Enums"]["crm_property_type"]
            | null
          purchase_price?: number | null
          source_post_id?: string | null
          sqft?: number | null
          status?: Database["public"]["Enums"]["crm_property_status"] | null
          tenure?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          baths?: number | null
          beds?: number | null
          created_at?: string
          current_value?: number | null
          equity?: number | null
          hero_image_url?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          notes?: string | null
          owner_entity?: string | null
          postcode?: string | null
          property_type?:
            | Database["public"]["Enums"]["crm_property_type"]
            | null
          purchase_price?: number | null
          source_post_id?: string | null
          sqft?: number | null
          status?: Database["public"]["Enums"]["crm_property_status"] | null
          tenure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_properties_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_rent_payments: {
        Row: {
          created_at: string
          due_amount: number
          due_date: string
          id: string
          method: string | null
          notes: string | null
          paid_amount: number
          paid_on: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_amount?: number
          due_date: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_amount?: number
          paid_on?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_amount?: number
          due_date?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_amount?: number
          paid_on?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_rent_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assignee_id: string | null
          body: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          feed_post_id: string | null
          id: string
          priority: number
          status: Database["public"]["Enums"]["crm_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          body?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          feed_post_id?: string | null
          id?: string
          priority?: number
          status?: Database["public"]["Enums"]["crm_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          body?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          feed_post_id?: string | null
          id?: string
          priority?: number
          status?: Database["public"]["Enums"]["crm_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tenants: {
        Row: {
          arrears_amount: number | null
          created_at: string
          deposit: number | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          rent_pcm: number | null
          status: Database["public"]["Enums"]["crm_tenant_status"] | null
          tenancy_end: string | null
          tenancy_start: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          arrears_amount?: number | null
          created_at?: string
          deposit?: number | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          rent_pcm?: number | null
          status?: Database["public"]["Enums"]["crm_tenant_status"] | null
          tenancy_end?: string | null
          tenancy_start?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          arrears_amount?: number | null
          created_at?: string
          deposit?: number | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          rent_pcm?: number | null
          status?: Database["public"]["Enums"]["crm_tenant_status"] | null
          tenancy_end?: string | null
          tenancy_start?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "crm_units"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_units: {
        Row: {
          beds: number | null
          created_at: string
          id: string
          label: string
          marketed_at: string | null
          property_id: string
          rent_pcm: number | null
          status: Database["public"]["Enums"]["crm_unit_status"] | null
          updated_at: string
        }
        Insert: {
          beds?: number | null
          created_at?: string
          id?: string
          label: string
          marketed_at?: string | null
          property_id: string
          rent_pcm?: number | null
          status?: Database["public"]["Enums"]["crm_unit_status"] | null
          updated_at?: string
        }
        Update: {
          beds?: number | null
          created_at?: string
          id?: string
          label?: string
          marketed_at?: string | null
          property_id?: string
          rent_pcm?: number | null
          status?: Database["public"]["Enums"]["crm_unit_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "crm_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          deal_id: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          deal_id?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_reviews: {
        Row: {
          context: Json
          created_at: string
          deliverable_url: string | null
          expert_notes: string | null
          fee_pence: number
          id: string
          listing_snapshot: Json
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          deliverable_url?: string | null
          expert_notes?: string | null
          fee_pence?: number
          id?: string
          listing_snapshot: Json
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          deliverable_url?: string | null
          expert_notes?: string | null
          fee_pence?: number
          id?: string
          listing_snapshot?: Json
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_interest: {
        Row: {
          created_at: string
          id: string
          note: string | null
          post_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          post_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          post_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_interest_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_poll_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          caption: string | null
          cover_url: string | null
          created_at: string
          deal_type: string | null
          display_mode: string
          hidden_fields: Json
          id: string
          is_published: boolean
          is_upcoming: boolean
          property_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          caption?: string | null
          cover_url?: string | null
          created_at?: string
          deal_type?: string | null
          display_mode?: string
          hidden_fields?: Json
          id?: string
          is_published?: boolean
          is_upcoming?: boolean
          property_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          caption?: string | null
          cover_url?: string | null
          created_at?: string
          deal_type?: string | null
          display_mode?: string
          hidden_fields?: Json
          id?: string
          is_published?: boolean
          is_upcoming?: boolean
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      hmo_analyses: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          inputs: Json
          label: string
          location: string | null
          property_id: string | null
          result: Json
          thumbnail: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inputs: Json
          label: string
          location?: string | null
          property_id?: string | null
          result: Json
          thumbnail?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
          label?: string
          location?: string | null
          property_id?: string | null
          result?: Json
          thumbnail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hmo_analyses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_watchlist: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_capital_injections: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date: string
          id?: string
          label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_capital_settings: {
        Row: {
          created_at: string
          starting_capital: number
          starting_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          starting_capital?: number
          starting_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          starting_capital?: number
          starting_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_timeline_entries: {
        Row: {
          assigned_to_property_id: string | null
          created_at: string
          id: string
          notes: string | null
          property_id: string
          purchase_date: string | null
          refi_month_offset: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to_property_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          property_id: string
          purchase_date?: string | null
          refi_month_offset?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to_property_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          property_id?: string
          purchase_date?: string | null
          refi_month_offset?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_timeline_entries_assigned_to_property_id_fkey"
            columns: ["assigned_to_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_timeline_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          created_at: string
          created_by: string | null
          geocoded_address: string | null
          geocoded_at: string | null
          id: string
          in_portfolio: boolean
          inputs: Json
          lat: number | null
          lng: number | null
          metrics: Json
          name: string
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          geocoded_address?: string | null
          geocoded_at?: string | null
          id?: string
          in_portfolio?: boolean
          inputs: Json
          lat?: number | null
          lng?: number | null
          metrics: Json
          name: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          geocoded_address?: string | null
          geocoded_at?: string | null
          id?: string
          in_portfolio?: boolean
          inputs?: Json
          lat?: number | null
          lng?: number | null
          metrics?: Json
          name?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      property_media: {
        Row: {
          created_at: string
          created_by: string | null
          filename: string | null
          id: string
          is_hero: boolean
          kind: string
          property_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          is_hero?: boolean
          kind: string
          property_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          is_hero?: boolean
          kind?: string
          property_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      token_fractions: {
        Row: {
          created_at: string
          price_per_share_pence: number
          token_id: string
          total_supply: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          price_per_share_pence: number
          token_id: string
          total_supply: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          price_per_share_pence?: number
          token_id?: string
          total_supply?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_fractions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: true
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_holdings: {
        Row: {
          created_at: string
          holder: string
          id: string
          shares: number
          token_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          holder: string
          id?: string
          shares: number
          token_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          holder?: string
          id?: string
          shares?: number
          token_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_holdings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_transfers: {
        Row: {
          amount: number
          created_at: string
          from_party: string | null
          id: string
          kind: string
          to_party: string
          token_id: string
          tx_hash: string
        }
        Insert: {
          amount?: number
          created_at?: string
          from_party?: string | null
          id?: string
          kind: string
          to_party: string
          token_id: string
          tx_hash: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_party?: string | null
          id?: string
          kind?: string
          to_party?: string
          token_id?: string
          tx_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transfers_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          chain: string
          created_at: string
          id: string
          metadata: Json
          minted_at: string
          owner_wallet: string
          property_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          chain?: string
          created_at?: string
          id?: string
          metadata?: Json
          minted_at?: string
          owner_wallet: string
          property_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          chain?: string
          created_at?: string
          id?: string
          metadata?: Json
          minted_at?: string
          owner_wallet?: string
          property_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tradesmen: {
        Row: {
          area_covered: string | null
          call_out_fee: number | null
          company: string | null
          created_at: string
          created_by: string | null
          day_rate: number | null
          email: string | null
          id: string
          lead_time_days: number | null
          name: string
          notes: string | null
          phone: string | null
          specialities: string[]
          updated_at: string
        }
        Insert: {
          area_covered?: string | null
          call_out_fee?: number | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          day_rate?: number | null
          email?: string | null
          id?: string
          lead_time_days?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          specialities?: string[]
          updated_at?: string
        }
        Update: {
          area_covered?: string | null
          call_out_fee?: number | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          day_rate?: number | null
          email?: string | null
          id?: string
          lead_time_days?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          specialities?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      tradesmen_candidates: {
        Row: {
          approved_tradesman_id: string | null
          area_covered: string | null
          background_check: Json | null
          background_checked_at: string | null
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          rating: number | null
          review_breakdown: Json | null
          review_count: number | null
          score: number | null
          search_query: string | null
          searched_at: string
          sense_check: Json | null
          social_presence_score: number | null
          sources: Json
          specialities: string[]
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          approved_tradesman_id?: string | null
          area_covered?: string | null
          background_check?: Json | null
          background_checked_at?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          rating?: number | null
          review_breakdown?: Json | null
          review_count?: number | null
          score?: number | null
          search_query?: string | null
          searched_at?: string
          sense_check?: Json | null
          social_presence_score?: number | null
          sources?: Json
          specialities?: string[]
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          approved_tradesman_id?: string | null
          area_covered?: string | null
          background_check?: Json | null
          background_checked_at?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          rating?: number | null
          review_breakdown?: Json | null
          review_count?: number | null
          score?: number | null
          search_query?: string | null
          searched_at?: string
          sense_check?: Json | null
          social_presence_score?: number | null
          sources?: Json
          specialities?: string[]
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tradesmen_candidates_approved_tradesman_id_fkey"
            columns: ["approved_tradesman_id"]
            isOneToOne: false
            referencedRelation: "tradesmen"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "expert" | "user" | "client"
      crm_activity_type:
        | "note"
        | "call"
        | "meeting"
        | "email"
        | "dm"
        | "interest"
        | "vote"
        | "save"
        | "stage_change"
        | "task_done"
      crm_lead_source:
        | "referral"
        | "feed"
        | "portal"
        | "event"
        | "cold"
        | "website"
        | "other"
      crm_lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "unqualified"
        | "converted"
      crm_project_stage:
        | "planning"
        | "permits"
        | "demo"
        | "first_fix"
        | "second_fix"
        | "snagging"
        | "complete"
        | "refinanced"
      crm_project_type:
        | "light_refurb"
        | "heavy_refurb"
        | "conversion"
        | "new_build"
      crm_property_status:
        | "sourcing"
        | "under_offer"
        | "owned"
        | "refurb"
        | "let"
        | "sold"
      crm_property_type:
        | "btl"
        | "hmo"
        | "flip"
        | "commercial"
        | "mixed"
        | "dev_site"
        | "other"
      crm_risk: "low" | "med" | "high"
      crm_stage:
        | "new"
        | "qualified"
        | "interested"
        | "negotiating"
        | "won"
        | "lost"
      crm_task_status: "open" | "done" | "snoozed"
      crm_tenant_status: "current" | "past" | "arrears" | "notice"
      crm_unit_status:
        | "vacant"
        | "marketing"
        | "offer"
        | "referencing"
        | "let"
        | "notice"
        | "refurb"
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
      app_role: ["admin", "expert", "user", "client"],
      crm_activity_type: [
        "note",
        "call",
        "meeting",
        "email",
        "dm",
        "interest",
        "vote",
        "save",
        "stage_change",
        "task_done",
      ],
      crm_lead_source: [
        "referral",
        "feed",
        "portal",
        "event",
        "cold",
        "website",
        "other",
      ],
      crm_lead_status: [
        "new",
        "contacted",
        "qualified",
        "unqualified",
        "converted",
      ],
      crm_project_stage: [
        "planning",
        "permits",
        "demo",
        "first_fix",
        "second_fix",
        "snagging",
        "complete",
        "refinanced",
      ],
      crm_project_type: [
        "light_refurb",
        "heavy_refurb",
        "conversion",
        "new_build",
      ],
      crm_property_status: [
        "sourcing",
        "under_offer",
        "owned",
        "refurb",
        "let",
        "sold",
      ],
      crm_property_type: [
        "btl",
        "hmo",
        "flip",
        "commercial",
        "mixed",
        "dev_site",
        "other",
      ],
      crm_risk: ["low", "med", "high"],
      crm_stage: [
        "new",
        "qualified",
        "interested",
        "negotiating",
        "won",
        "lost",
      ],
      crm_task_status: ["open", "done", "snoozed"],
      crm_tenant_status: ["current", "past", "arrears", "notice"],
      crm_unit_status: [
        "vacant",
        "marketing",
        "offer",
        "referencing",
        "let",
        "notice",
        "refurb",
      ],
    },
  },
} as const
