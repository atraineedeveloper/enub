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
    PostgrestVersion: "12.2.3 (519615d)"
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
    Enums: {},
  },
} as const
