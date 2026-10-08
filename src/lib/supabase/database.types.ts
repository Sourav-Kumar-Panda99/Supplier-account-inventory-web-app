/**
 * Minimal hand-written types for the tables touched through the
 * service-role admin client (lib/supabase/admin.ts). Recent @supabase/supabase-js
 * versions require the schema to satisfy their GenericSchema shape (Tables /
 * Views / Functions, and each table needs a Relationships array) or table
 * access silently resolves to `never` instead of erroring at the client
 * construction site. This covers profiles (creating supplier / media-buyer
 * logins), accounts (supplier and media-buyer screens have no RLS policy of
 * their own — see lib/data/accounts.ts), account_secrets, and audit_log —
 * admin reads/writes go through the RLS-bound client in
 * lib/supabase/server.ts, which types those calls permissively via @supabase/ssr.
 *
 * If you generate full types later (`supabase gen types typescript`), you
 * can swap this file for the generated one without changing call sites.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: string;
          upi_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: string;
          upi_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          supplier_id: string | null;
          supplier_name: string;
          upi_id: string | null;
          platform: string;
          login_identifier: string;
          linked_email: string | null;
          recovery_email: string | null;
          profile_age: string | null;
          status: string;
          rejection_note: string | null;
          status_changed_by: string | null;
          status_changed_at: string | null;
          assigned_to: string | null;
          assigned_at: string | null;
          assigned_by: string | null;
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id?: string | null;
          supplier_name: string;
          upi_id?: string | null;
          platform?: string;
          login_identifier: string;
          linked_email?: string | null;
          recovery_email?: string | null;
          profile_age?: string | null;
          status?: string;
          rejection_note?: string | null;
          status_changed_by?: string | null;
          status_changed_at?: string | null;
          assigned_to?: string | null;
          assigned_at?: string | null;
          assigned_by?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
      account_secrets: {
        Row: {
          id: string;
          account_id: string;
          secret_type: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          key_version: number;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          secret_type: string;
          ciphertext: string;
          iv: string;
          auth_tag: string;
          key_version: number;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_secrets"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          secret_type: string | null;
          outcome: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          secret_type?: string | null;
          outcome: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
