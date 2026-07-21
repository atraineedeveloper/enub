export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      date_of_admissions: {
        Row: {
          created_at: string
          date_of_admission: string | null
          id: number
          type: string | null
          worker_id: number | null
        }
        Insert: {
          created_at?: string
          date_of_admission?: string | null
          id?: number
          type?: string | null
          worker_id?: number | null
        }
        Update: {
          created_at?: string
          date_of_admission?: string | null
          id?: number
          type?: string | null
          worker_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "date_of_admissions_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      degrees: {
        Row: {
          code: string | null
          created_at: string
          id: number
          name: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: number
          name?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          created_at: string
          degree_id: number | null
          id: number
          letter: string | null
          year_of_admission: number | null
        }
        Insert: {
          created_at?: string
          degree_id?: number | null
          id?: number
          letter?: string | null
          year_of_admission?: number | null
        }
        Update: {
          created_at?: string
          degree_id?: number | null
          id?: number
          letter?: string | null
          year_of_admission?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: string
          worker_id: number | null
        }
        Insert: {
          created_at?: string
          id: string
          role: string
          worker_id?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          worker_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: number
          role: string | null
          worker_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          role?: string | null
          worker_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          role?: string | null
          worker_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          created_at: string
          end_time: string | null
          group_id: number | null
          id: number
          semester_id: number | null
          start_time: string | null
          subject_id: number | null
          weekday: string | null
          worker_id: number | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          group_id?: number | null
          id?: number
          semester_id?: number | null
          start_time?: string | null
          subject_id?: number | null
          weekday?: string | null
          worker_id?: number | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          group_id?: number | null
          id?: number
          semester_id?: number | null
          start_time?: string | null
          subject_id?: number | null
          weekday?: string | null
          worker_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_teachers: {
        Row: {
          activity: string | null
          created_at: string
          end_time: string | null
          id: number
          semester_id: number | null
          start_time: string | null
          weekday: string | null
          worker_id: number | null
        }
        Insert: {
          activity?: string | null
          created_at?: string
          end_time?: string | null
          id?: number
          semester_id?: number | null
          start_time?: string | null
          weekday?: string | null
          worker_id?: number | null
        }
        Update: {
          activity?: string | null
          created_at?: string
          end_time?: string | null
          id?: number
          semester_id?: number | null
          start_time?: string | null
          weekday?: string | null
          worker_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_teachers_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_teachers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          created_at: string
          id: number
          school_year: string | null
          semester: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          school_year?: string | null
          semester?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          school_year?: string | null
          semester?: string | null
        }
        Relationships: []
      }
      state_roles: {
        Row: {
          created_at: string
          id: number
          name_worker: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          name_worker?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name_worker?: string | null
          role?: string | null
        }
        Relationships: []
      }
      study_programs: {
        Row: {
          created_at: string
          id: number
          name: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          year?: number | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          credits: number | null
          degree_id: number | null
          hours_per_semester: number | null
          hours_per_week: number | null
          id: number
          name: string | null
          semester: string | null
          study_program_id: number | null
        }
        Insert: {
          created_at?: string
          credits?: number | null
          degree_id?: number | null
          hours_per_semester?: number | null
          hours_per_week?: number | null
          id?: number
          name?: string | null
          semester?: string | null
          study_program_id?: number | null
        }
        Update: {
          created_at?: string
          credits?: number | null
          degree_id?: number | null
          hours_per_semester?: number | null
          hours_per_week?: number | null
          id?: number
          name?: string | null
          semester?: string | null
          study_program_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_degree_id_fkey"
            columns: ["degree_id"]
            isOneToOne: false
            referencedRelation: "degrees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_study_program_id_fkey"
            columns: ["study_program_id"]
            isOneToOne: false
            referencedRelation: "study_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      sustenance_plazas: {
        Row: {
          created_at: string
          id: number
          payment_key: string | null
          plaza: string | null
          sustenance: string | null
          worker_id: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          payment_key?: string | null
          plaza?: string | null
          sustenance?: string | null
          worker_id?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          payment_key?: string | null
          plaza?: string | null
          sustenance?: string | null
          worker_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sustenance_plazas_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      utilities: {
        Row: {
          created_at: string
          description: string | null
          id: number
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          value?: string | null
        }
        Relationships: []
      }
      worker_access_email_corrections: {
        Row: {
          claimed_by: string | null
          created_at: string
          id: number
          last_reason_code: string | null
          linked_auth_user_id: string
          raw_expected_worker_email: string | null
          requested_canonical_email: string
          state: string
          updated_at: string
          worker_id: number
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          id?: never
          last_reason_code?: string | null
          linked_auth_user_id: string
          raw_expected_worker_email?: string | null
          requested_canonical_email: string
          state: string
          updated_at?: string
          worker_id: number
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          id?: never
          last_reason_code?: string | null
          linked_auth_user_id?: string
          raw_expected_worker_email?: string | null
          requested_canonical_email?: string
          state?: string
          updated_at?: string
          worker_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_access_email_corrections_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_document_categories: {
        Row: {
          created_at: string
          id: number
          name: string
          scope: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          scope: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          scope?: string
          sort_order?: number
        }
        Relationships: []
      }
      worker_document_types: {
        Row: {
          allows_multiple: boolean
          category_id: number
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          allows_multiple?: boolean
          category_id: number
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          allows_multiple?: boolean
          category_id?: number
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_document_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "worker_document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_documents: {
        Row: {
          created_at: string
          document_type_id: number
          file_name: string
          file_size: number
          id: number
          mime_type: string
          semester_id: number | null
          storage_path: string
          uploaded_by: string | null
          worker_id: number
        }
        Insert: {
          created_at?: string
          document_type_id: number
          file_name: string
          file_size: number
          id?: number
          mime_type: string
          semester_id?: number | null
          storage_path: string
          uploaded_by?: string | null
          worker_id: number
        }
        Update: {
          created_at?: string
          document_type_id?: number
          file_name?: string
          file_size?: number
          id?: number
          mime_type?: string
          semester_id?: number | null
          storage_path?: string
          uploaded_by?: string | null
          worker_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "worker_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_documents_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_documents_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          function_performed: string | null
          id: number
          name: string | null
          neighborhood: string | null
          observations: string | null
          phone: string | null
          post_code: string | null
          profile_picture: string | null
          RFC: string | null
          specialty: string | null
          state: string | null
          status: number | null
          street: string | null
          type_worker: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          function_performed?: string | null
          id?: number
          name?: string | null
          neighborhood?: string | null
          observations?: string | null
          phone?: string | null
          post_code?: string | null
          profile_picture?: string | null
          RFC?: string | null
          specialty?: string | null
          state?: string | null
          status?: number | null
          street?: string | null
          type_worker?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          function_performed?: string | null
          id?: number
          name?: string | null
          neighborhood?: string | null
          observations?: string | null
          phone?: string | null
          post_code?: string | null
          profile_picture?: string | null
          RFC?: string | null
          specialty?: string | null
          state?: string | null
          status?: number | null
          street?: string | null
          type_worker?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _replace_schedule_ownership_select_policy: {
        Args: {
          admin_staff_policy_name: string
          target_table: string
          worker_policy_name: string
        }
        Returns: undefined
      }
      claim_worker_access_email_correction: {
        Args: { requested_email: string; worker_id: number }
        Returns: {
          operation_id: number
          outcome: string
          reason_code: string
        }[]
      }
      current_app_role: { Args: never; Returns: string }
      current_worker_id: { Args: never; Returns: number }
      find_auth_users_by_canonical_email: {
        Args: { raw_email: string }
        Returns: string[]
      }
      get_linked_worker_auth_email_context: {
        Args: { worker_id: number }
        Returns: string
      }
      get_worker_access_email_correction_auth_email: {
        Args: { p_operation_id: number }
        Returns: string
      }
      get_worker_access_email_correction_context: {
        Args: { p_operation_id: number }
        Returns: {
          last_reason_code: string
          linked_auth_user_id: string
          operation_id: number
          raw_expected_worker_email: string
          requested_canonical_email: string
          state: string
          worker_id: number
        }[]
      }
      grant_staff_role: { Args: { staff_email: string }; Returns: undefined }
      link_worker_account: {
        Args: { worker_email: string; worker_id: number }
        Returns: undefined
      }
      mark_worker_access_email_correction_completed: {
        Args: { p_operation_id: number }
        Returns: boolean
      }
      mark_worker_access_email_correction_manual_attention: {
        Args: { p_operation_id: number; p_reason_code: string }
        Returns: undefined
      }
      replace_worker_document_metadata: {
        Args: {
          p_document_type_id: number
          p_file_name: string
          p_file_size: number
          p_mime_type: string
          p_semester_id: number
          p_storage_path: string
          p_worker_id: number
        }
        Returns: {
          new_created_at: string
          new_document_type_id: number
          new_file_name: string
          new_file_size: number
          new_id: number
          new_mime_type: string
          new_semester_id: number
          new_storage_path: string
          new_uploaded_by: string
          new_worker_id: number
          old_storage_paths: string[]
        }[]
      }
      sync_worker_email_after_access_correction: {
        Args: { operation_id: number }
        Returns: string
      }
      unlink_worker_account: { Args: { worker_id: number }; Returns: undefined }
      update_worker_with_relations: {
        Args: {
          p_date_of_admissions?: Json
          p_sustenance_plazas?: Json
          p_worker: Json
          p_worker_id: number
        }
        Returns: {
          city: string | null
          created_at: string
          email: string | null
          function_performed: string | null
          id: number
          name: string | null
          neighborhood: string | null
          observations: string | null
          phone: string | null
          post_code: string | null
          profile_picture: string | null
          RFC: string | null
          specialty: string | null
          state: string | null
          status: number | null
          street: string | null
          type_worker: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "workers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      validate_worker_access_email_correction_identity: {
        Args: { p_operation_id: number }
        Returns: string
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
