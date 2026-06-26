export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      trusts: {
        Row: {
          id: string;
          legal_name: string;
          stripe_account_id: string | null;
          country: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legal_name: string;
          stripe_account_id?: string | null;
          country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          legal_name?: string;
          stripe_account_id?: string | null;
          country?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schools: {
        Row: {
          id: string;
          trust_id: string;
          name: string;
          urn: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trust_id: string;
          name: string;
          urn?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trust_id?: string;
          name?: string;
          urn?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schools_trust_id_fkey";
            columns: ["trust_id"];
            isOneToOne: false;
            referencedRelation: "trusts";
            referencedColumns: ["id"];
          }
        ];
      };
      admin_users: {
        Row: {
          id: string;
          school_id: string;
          auth_user_id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          auth_user_id: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          auth_user_id?: string;
          email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_users_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          }
        ];
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          first_name: string;
          year_group: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          first_name: string;
          year_group: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          first_name?: string;
          year_group?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          }
        ];
      };
      guardians: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      guardian_student: {
        Row: {
          guardian_id: string;
          student_id: string;
          relationship: string;
        };
        Insert: {
          guardian_id: string;
          student_id: string;
          relationship: string;
        };
        Update: {
          guardian_id?: string;
          student_id?: string;
          relationship?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_student_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_student_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      payment_requests: {
        Row: {
          id: string;
          school_id: string;
          title: string;
          description: string | null;
          amount_pence: number;
          due_date: string;
          year_groups: string[] | null;
          status: "open" | "closed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          title: string;
          description?: string | null;
          amount_pence: number;
          due_date: string;
          year_groups?: string[] | null;
          status?: "open" | "closed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          title?: string;
          description?: string | null;
          amount_pence?: number;
          due_date?: string;
          year_groups?: string[] | null;
          status?: "open" | "closed" | "cancelled";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_requests_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          }
        ];
      };
      assignments: {
        Row: {
          id: string;
          payment_request_id: string;
          student_id: string;
          amount_due_pence: number;
          amount_paid_pence: number;
          status: "unpaid" | "partial" | "paid" | "waived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_request_id: string;
          student_id: string;
          amount_due_pence: number;
          amount_paid_pence?: number;
          status?: "unpaid" | "partial" | "paid" | "waived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          payment_request_id?: string;
          student_id?: string;
          amount_due_pence?: number;
          amount_paid_pence?: number;
          status?: "unpaid" | "partial" | "paid" | "waived";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_payment_request_id_fkey";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          guardian_id: string;
          stripe_payment_intent: string | null;
          amount_pence: number;
          status: "pending" | "succeeded" | "failed" | "refunded";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          guardian_id: string;
          stripe_payment_intent?: string | null;
          amount_pence: number;
          status?: "pending" | "succeeded" | "failed" | "refunded";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          guardian_id?: string;
          stripe_payment_intent?: string | null;
          amount_pence?: number;
          status?: "pending" | "succeeded" | "failed" | "refunded";
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          }
        ];
      };
      transaction_lines: {
        Row: {
          id: string;
          transaction_id: string;
          assignment_id: string;
          amount_pence: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          assignment_id: string;
          amount_pence: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          assignment_id?: string;
          amount_pence?: number;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_lines_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_lines_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          }
        ];
      };
      ledger_entries: {
        Row: {
          id: string;
          transaction_id: string;
          account: string;
          debit_pence: number;
          credit_pence: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          account: string;
          debit_pence?: number;
          credit_pence?: number;
          created_at?: string;
        };
        Update: Record<string, never>; // append-only — no updates
        Relationships: [
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          }
        ];
      };
      email_log: {
        Row: {
          id: string;
          guardian_id: string;
          payment_request_id: string;
          resend_message_id: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          guardian_id: string;
          payment_request_id: string;
          resend_message_id?: string | null;
          sent_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "email_log_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_log_payment_request_id_fkey";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          type: string;
          payload: Record<string, unknown>;
          processed_at: string;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          type: string;
          payload: Record<string, unknown>;
          processed_at?: string;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          type?: string;
          payload?: Record<string, unknown>;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      my_school_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
