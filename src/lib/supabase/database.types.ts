/**
 * Minimal hand-written types for the tables touched through the
 * service-role admin client (lib/supabase/admin.ts). Recent @supabase/supabase-js
 * versions require the schema to satisfy their GenericSchema shape (Tables /
 * Views / Functions, and each table needs a Relationships array) or table
 * access silently resolves to `never` instead of erroring at the client
 * construction site. This only needs to cover account_secrets and
 * audit_log — everything else goes through the RLS-bound client in
 * lib/supabase/server.ts, which types those calls permissively via @supabase/ssr.
 *
 * If you generate full types later (`supabase gen types typescript`), you
 * can swap this file for the generated one without changing call sites.
 */
export interface Database {
  public: {
    Tables: {
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
