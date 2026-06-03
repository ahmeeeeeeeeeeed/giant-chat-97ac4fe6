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
      direct_messages: {
        Row: {
          content: string
          created_at: string
          deleted_for: string[]
          id: string
          media_duration_ms: number | null
          media_url: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          read_at: string | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          deleted_for?: string[]
          id?: string
          media_duration_ms?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_for?: string[]
          id?: string
          media_duration_ms?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      dm_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      dm_mutes: {
        Row: {
          created_at: string
          muted_id: string
          muter_id: string
        }
        Insert: {
          created_at?: string
          muted_id: string
          muter_id: string
        }
        Update: {
          created_at?: string
          muted_id?: string
          muter_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      game_guesses: {
        Row: {
          ai_name: string | null
          created_at: string
          display_name: string
          id: string
          round_id: string
          seat_idx: number
          user_id: string | null
          value: number
        }
        Insert: {
          ai_name?: string | null
          created_at?: string
          display_name: string
          id?: string
          round_id: string
          seat_idx: number
          user_id?: string | null
          value: number
        }
        Update: {
          ai_name?: string | null
          created_at?: string
          display_name?: string
          id?: string
          round_id?: string
          seat_idx?: number
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_guesses_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          deadline_at: string
          ended_at: string | null
          id: string
          secret: number
          started_at: string
          status: string
          winner_id: string | null
          winner_name: string | null
          winner_value: number | null
        }
        Insert: {
          deadline_at?: string
          ended_at?: string | null
          id?: string
          secret?: number
          started_at?: string
          status?: string
          winner_id?: string | null
          winner_name?: string | null
          winner_value?: number | null
        }
        Update: {
          deadline_at?: string
          ended_at?: string | null
          id?: string
          secret?: number
          started_at?: string
          status?: string
          winner_id?: string | null
          winner_name?: string | null
          winner_value?: number | null
        }
        Relationships: []
      }
      game_seats: {
        Row: {
          ai_name: string | null
          round_id: string
          seat_idx: number
          user_id: string | null
        }
        Insert: {
          ai_name?: string | null
          round_id: string
          seat_idx: number
          user_id?: string | null
        }
        Update: {
          ai_name?: string | null
          round_id?: string
          seat_idx?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_seats_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      game_system_messages: {
        Row: {
          created_at: string
          id: string
          params: Json | null
          text_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          params?: Json | null
          text_key: string
        }
        Update: {
          created_at?: string
          id?: string
          params?: Json | null
          text_key?: string
        }
        Relationships: []
      }
      game_waitlist: {
        Row: {
          joined_at: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_visits: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          dm_locked: boolean
          gender: string | null
          hide_last_seen: boolean
          id: string
          last_seen_at: string
          points: number
          profile_views: number
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          dm_locked?: boolean
          gender?: string | null
          hide_last_seen?: boolean
          id: string
          last_seen_at?: string
          points?: number
          profile_views?: number
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          dm_locked?: boolean
          gender?: string | null
          hide_last_seen?: boolean
          id?: string
          last_seen_at?: string
          points?: number
          profile_views?: number
          username?: string
        }
        Relationships: []
      }
      room_bans: {
        Row: {
          banned_by: string
          created_at: string
          reason: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          reason?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          reason?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: []
      }
      room_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          event: Database["public"]["Enums"]["room_log_event"]
          id: string
          meta: Json | null
          room_id: string
          target_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: Database["public"]["Enums"]["room_log_event"]
          id?: string
          meta?: Json | null
          room_id: string
          target_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: Database["public"]["Enums"]["room_log_event"]
          id?: string
          meta?: Json | null
          room_id?: string
          target_id?: string | null
        }
        Relationships: []
      }
      room_members: {
        Row: {
          joined_at: string
          muted: boolean
          rank: Database["public"]["Enums"]["room_rank"]
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          muted?: boolean
          rank?: Database["public"]["Enums"]["room_rank"]
          room_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          muted?: boolean
          rank?: Database["public"]["Enums"]["room_rank"]
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          media_duration_ms: number | null
          media_url: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          room_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_duration_ms?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          room_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_duration_ms?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
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
      admin_broadcast: { Args: { _text: string }; Returns: undefined }
      admin_send_points: {
        Args: { _amount: number; _target: string }
        Returns: undefined
      }
      ban_room_member: {
        Args: { _reason?: string; _room: string; _user: string }
        Returns: undefined
      }
      dm_delete_for_all: { Args: { _id: string }; Returns: undefined }
      dm_delete_for_me: { Args: { _id: string }; Returns: undefined }
      dm_mark_read: { Args: { _peer: string }; Returns: undefined }
      game_ensure_round: { Args: never; Returns: string }
      game_fill_ai: { Args: { _rid: string }; Returns: undefined }
      game_guess: { Args: { _value: number }; Returns: undefined }
      game_join: { Args: never; Returns: Json }
      game_maybe_end: { Args: { _rid: string }; Returns: undefined }
      game_tick: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_profile_view: { Args: { _target: string }; Returns: number }
      is_room_member: {
        Args: { _room: string; _user: string }
        Returns: boolean
      }
      kick_room_member: {
        Args: { _room: string; _user: string }
        Returns: undefined
      }
      room_joined_at: {
        Args: { _room: string; _user: string }
        Returns: string
      }
      room_rank_of: {
        Args: { _room: string; _user: string }
        Returns: Database["public"]["Enums"]["room_rank"]
      }
      set_member_rank: {
        Args: {
          _new_rank: Database["public"]["Enums"]["room_rank"]
          _room: string
          _user: string
        }
        Returns: undefined
      }
      transfer_room_ownership: {
        Args: { _new_owner: string; _room: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      friendship_status: "pending" | "accepted" | "blocked"
      message_type: "text" | "image" | "voice"
      room_log_event:
        | "join"
        | "leave"
        | "kick"
        | "ban"
        | "unban"
        | "promote"
        | "demote"
        | "transfer"
        | "mute"
        | "unmute"
      room_rank: "owner" | "admin" | "member"
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
      app_role: ["admin", "user"],
      friendship_status: ["pending", "accepted", "blocked"],
      message_type: ["text", "image", "voice"],
      room_log_event: [
        "join",
        "leave",
        "kick",
        "ban",
        "unban",
        "promote",
        "demote",
        "transfer",
        "mute",
        "unmute",
      ],
      room_rank: ["owner", "admin", "member"],
    },
  },
} as const
