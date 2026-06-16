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
      account_deletion_requests: {
        Row: {
          created_at: string
          email_snapshot: string | null
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          username_snapshot: string | null
        }
        Insert: {
          created_at?: string
          email_snapshot?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username_snapshot?: string | null
        }
        Update: {
          created_at?: string
          email_snapshot?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username_snapshot?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_updates: {
        Row: {
          created_at: string
          created_by: string | null
          file_size: number | null
          file_url: string
          id: string
          is_active: boolean
          minimum_required_code: number
          minimum_required_version: string
          update_message: string
          update_type: string
          updated_at: string
          version: string
          version_code: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_active?: boolean
          minimum_required_code?: number
          minimum_required_version?: string
          update_message?: string
          update_type?: string
          updated_at?: string
          version: string
          version_code: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_active?: boolean
          minimum_required_code?: number
          minimum_required_version?: string
          update_message?: string
          update_type?: string
          updated_at?: string
          version?: string
          version_code?: number
        }
        Relationships: []
      }
      badges: {
        Row: {
          badge_type: string | null
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
        }
        Insert: {
          badge_type?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
        }
        Update: {
          badge_type?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
        }
        Relationships: []
      }
      bot_subagents: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          password: string
          room_id: string
          silent: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          password: string
          room_id: string
          silent?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          password?: string
          room_id?: string
          silent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bot_subagents_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          edited: boolean
          id: string
          kind: Database["public"]["Enums"]["community_post_kind"]
          media_type: string | null
          media_url: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          edited?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["community_post_kind"]
          media_type?: string | null
          media_url?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          edited?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["community_post_kind"]
          media_type?: string | null
          media_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          created_at: string
          post_id: string
          reaction: Database["public"]["Enums"]["community_reaction"]
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction: Database["public"]["Enums"]["community_reaction"]
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction?: Database["public"]["Enums"]["community_reaction"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string | null
          reporter_id: string
          status: Database["public"]["Enums"]["community_report_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason?: string | null
          reporter_id: string
          status?: Database["public"]["Enums"]["community_report_status"]
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string | null
          reporter_id?: string
          status?: Database["public"]["Enums"]["community_report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          deleted_for: string[]
          delivered_at: string | null
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
          delivered_at?: string | null
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
          delivered_at?: string | null
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
      gift_transactions: {
        Row: {
          cost_points: number
          created_at: string
          gift_id: string
          id: string
          message: string | null
          receiver_id: string
          room_id: string | null
          scope: string
          sender_id: string
        }
        Insert: {
          cost_points?: number
          created_at?: string
          gift_id: string
          id?: string
          message?: string | null
          receiver_id: string
          room_id?: string | null
          scope?: string
          sender_id: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          gift_id?: string
          id?: string
          message?: string | null
          receiver_id?: string
          room_id?: string | null
          scope?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts_catalog: {
        Row: {
          animation_url: string | null
          category: string | null
          cost_points: number
          created_at: string
          effect_type: string
          emoji: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          scope: string
          sort_order: number
        }
        Insert: {
          animation_url?: string | null
          category?: string | null
          cost_points?: number
          created_at?: string
          effect_type?: string
          emoji?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          scope?: string
          sort_order?: number
        }
        Update: {
          animation_url?: string | null
          category?: string | null
          cost_points?: number
          created_at?: string
          effect_type?: string
          emoji?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          sort_order?: number
        }
        Relationships: []
      }
      level_thresholds: {
        Row: {
          level: number
          min_points: number
          name: string
        }
        Insert: {
          level: number
          min_points: number
          name: string
        }
        Update: {
          level?: number
          min_points?: number
          name?: string
        }
        Relationships: []
      }
      login_history: {
        Row: {
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          id: string
          ip: string | null
          region: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          region?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      music_broadcast_reactions: {
        Row: {
          broadcast_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          emoji: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_broadcast_reactions_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "music_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      music_broadcasts: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          requester_name: string
          track: Json
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          requester_name: string
          track: Json
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          requester_name?: string
          track?: Json
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
          auth_email: string | null
          avatar_url: string | null
          ban_reason: string | null
          bio: string | null
          country: string | null
          cover_type: string | null
          cover_url: string | null
          created_at: string
          dm_locked: boolean
          equipped_badge: string | null
          equipped_chat_color: string | null
          equipped_effect: string | null
          equipped_name_color: string | null
          game_wins: number
          gender: string | null
          hide_last_seen: boolean
          id: string
          is_banned: boolean
          is_bot: boolean
          is_premium: boolean
          last_seen_at: string
          points: number
          profile_views: number
          recovery_email: string | null
          recovery_email_verified_at: string | null
          username: string
        }
        Insert: {
          auth_email?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          country?: string | null
          cover_type?: string | null
          cover_url?: string | null
          created_at?: string
          dm_locked?: boolean
          equipped_badge?: string | null
          equipped_chat_color?: string | null
          equipped_effect?: string | null
          equipped_name_color?: string | null
          game_wins?: number
          gender?: string | null
          hide_last_seen?: boolean
          id: string
          is_banned?: boolean
          is_bot?: boolean
          is_premium?: boolean
          last_seen_at?: string
          points?: number
          profile_views?: number
          recovery_email?: string | null
          recovery_email_verified_at?: string | null
          username: string
        }
        Update: {
          auth_email?: string | null
          avatar_url?: string | null
          ban_reason?: string | null
          bio?: string | null
          country?: string | null
          cover_type?: string | null
          cover_url?: string | null
          created_at?: string
          dm_locked?: boolean
          equipped_badge?: string | null
          equipped_chat_color?: string | null
          equipped_effect?: string | null
          equipped_name_color?: string | null
          game_wins?: number
          gender?: string | null
          hide_last_seen?: boolean
          id?: string
          is_banned?: boolean
          is_bot?: boolean
          is_premium?: boolean
          last_seen_at?: string
          points?: number
          profile_views?: number
          recovery_email?: string | null
          recovery_email_verified_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_equipped_badge_fkey"
            columns: ["equipped_badge"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_equipped_chat_color_fkey"
            columns: ["equipped_chat_color"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_equipped_effect_fkey"
            columns: ["equipped_effect"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_equipped_name_color_fkey"
            columns: ["equipped_name_color"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "room_bans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "room_logs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
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
          meta: Json | null
          room_id: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_duration_ms?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          meta?: Json | null
          room_id: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_duration_ms?: number | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          meta?: Json | null
          room_id?: string
          user_id?: string | null
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
      room_music: {
        Row: {
          current: Json | null
          paused: boolean
          paused_pos_ms: number
          queue: Json
          room_id: string
          started_at: string | null
          updated_at: string
          volume: number
        }
        Insert: {
          current?: Json | null
          paused?: boolean
          paused_pos_ms?: number
          queue?: Json
          room_id: string
          started_at?: string | null
          updated_at?: string
          volume?: number
        }
        Update: {
          current?: Json | null
          paused?: boolean
          paused_pos_ms?: number
          queue?: Json
          room_id?: string
          started_at?: string | null
          updated_at?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_music_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          background_type: string | null
          background_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_members: number
          name: string
          owner_id: string
          password_hash: string | null
          type: string
        }
        Insert: {
          background_type?: string | null
          background_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_members?: number
          name: string
          owner_id: string
          password_hash?: string | null
          type?: string
        }
        Update: {
          background_type?: string | null
          background_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_members?: number
          name?: string
          owner_id?: string
          password_hash?: string | null
          type?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          code: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["shop_item_kind"]
          name_ar: string
          payload: Json
          price: number
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["shop_item_kind"]
          name_ar: string
          payload?: Json
          price: number
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["shop_item_kind"]
          name_ar?: string
          payload?: Json
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          awarded_at: string | null
          awarded_by: string | null
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          awarded_by?: string | null
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_progress: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          day: string
          progress: number
          task_kind: string
          user_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          day?: string
          progress?: number
          task_kind: string
          user_id: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          day?: string
          progress?: number
          task_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          acquired_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
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
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          purpose: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_all_bots_to_room: { Args: { _room: string }; Returns: undefined }
      add_member_to_room: { Args: { p_room_id: string }; Returns: Json }
      admin_broadcast: { Args: { _text: string }; Returns: undefined }
      admin_delete_post: { Args: { _post: string }; Returns: undefined }
      admin_delete_user: { Args: { _target: string }; Returns: undefined }
      admin_get_password_hash: { Args: { _target: string }; Returns: string }
      admin_list_users: {
        Args: never
        Returns: {
          avatar_url: string
          ban_reason: string
          country: string
          created_at: string
          id: string
          is_banned: boolean
          last_seen_at: string
          points: number
          roles: string[]
          username: string
        }[]
      }
      admin_reset_username: {
        Args: { _new_username: string; _target: string }
        Returns: undefined
      }
      admin_send_points: {
        Args: { _amount: number; _target: string }
        Returns: undefined
      }
      admin_set_banned: {
        Args: { _banned: boolean; _reason?: string; _target: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      ban_room_member: {
        Args: { _reason?: string; _room: string; _user: string }
        Returns: undefined
      }
      claim_daily_reward: { Args: { _kind: string }; Returns: Json }
      compute_level: { Args: { _points: number }; Returns: number }
      confirm_email_verification_code: {
        Args: { _code: string }
        Returns: boolean
      }
      consume_recovery_code: {
        Args: { _code: string; _username: string }
        Returns: string
      }
      daily_task_meta: {
        Args: { _kind: string }
        Returns: {
          label: string
          reward: number
          target: number
        }[]
      }
      dm_delete_for_all: { Args: { _id: string }; Returns: undefined }
      dm_delete_for_me: { Args: { _id: string }; Returns: undefined }
      dm_mark_delivered: { Args: { _peer: string }; Returns: undefined }
      dm_mark_read: { Args: { _peer: string }; Returns: undefined }
      game_ensure_round: { Args: never; Returns: string }
      game_fill_ai: { Args: { _rid: string }; Returns: undefined }
      game_guess: { Args: { _value: number }; Returns: undefined }
      game_join: { Args: never; Returns: Json }
      game_maybe_end: { Args: { _rid: string }; Returns: undefined }
      game_tick: { Args: never; Returns: undefined }
      get_bot_id: { Args: never; Returns: string }
      get_my_daily_tasks: {
        Args: never
        Returns: {
          claimed: boolean
          kind: string
          label: string
          progress: number
          reward: number
          target: number
        }[]
      }
      get_my_recovery_status: {
        Args: never
        Returns: {
          recovery_email: string
          recovery_email_verified_at: string
        }[]
      }
      get_top_game_winners: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          user_id: string
          username: string
          wins: number
        }[]
      }
      get_weekly_leaderboards: { Args: { _limit?: number }; Returns: Json }
      get_weekly_user_stats: { Args: { _user: string }; Returns: Json }
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
      issue_email_verification_code: {
        Args: { _email: string }
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      issue_recovery_code: {
        Args: { _email: string; _username: string }
        Returns: {
          code: string
          email: string
          expires_at: string
          user_id: string
        }[]
      }
      kick_room_member: {
        Args: { _room: string; _user: string }
        Returns: undefined
      }
      lookup_auth_email: { Args: { _username: string }; Returns: string }
      mark_profile_premium: {
        Args: { _email: string; _target: string; _username: string }
        Returns: undefined
      }
      music_advance_if_ended: { Args: { _room: string }; Returns: undefined }
      music_broadcast_publish:
        | { Args: { _track: Json }; Returns: string }
        | { Args: { _source_room?: string; _track: Json }; Returns: string }
      music_broadcast_react: {
        Args: { _bid: string; _emoji: string }
        Returns: undefined
      }
      music_pause: { Args: { _room: string }; Returns: undefined }
      music_play: { Args: { _room: string; _track: Json }; Returns: undefined }
      music_resume: { Args: { _room: string }; Returns: undefined }
      music_seek: {
        Args: { _pos_ms: number; _room: string }
        Returns: undefined
      }
      music_set_volume: {
        Args: { _room: string; _vol: number }
        Returns: undefined
      }
      music_share_to_user: {
        Args: { _peer: string; _track: Json }
        Returns: undefined
      }
      music_skip: { Args: { _room: string }; Returns: undefined }
      music_stop: { Args: { _room: string }; Returns: undefined }
      premium_charge_points: { Args: { _cost?: number }; Returns: undefined }
      record_daily_action: {
        Args: { _amount?: number; _kind: string }
        Returns: undefined
      }
      record_game_win: {
        Args: { _game: string; _points?: number }
        Returns: undefined
      }
      room_bot_say: {
        Args: { _kind?: string; _meta?: Json; _room: string; _text: string }
        Returns: undefined
      }
      room_invite_friends: { Args: { _room: string }; Returns: number }
      room_invite_username: {
        Args: { _room: string; _username: string }
        Returns: boolean
      }
      room_join: {
        Args: { _password?: string; _room: string }
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
      send_gift: {
        Args: {
          _gift: string
          _message?: string
          _receiver: string
          _room?: string
        }
        Returns: string
      }
      set_member_rank: {
        Args: {
          _new_rank: Database["public"]["Enums"]["room_rank"]
          _room: string
          _user: string
        }
        Returns: undefined
      }
      set_profile_cover: {
        Args: { _type: string; _url: string }
        Returns: undefined
      }
      set_room_background: {
        Args: { _room: string; _type: string; _url: string }
        Returns: undefined
      }
      set_room_password: {
        Args: { _password: string; _room: string }
        Returns: undefined
      }
      share_post_to_all_rooms: {
        Args: { _image_url?: string; _source_room?: string; _text: string }
        Returns: undefined
      }
      shop_equip: { Args: { _item: string }; Returns: undefined }
      shop_purchase: { Args: { _item: string }; Returns: undefined }
      shop_unequip: {
        Args: { _kind: Database["public"]["Enums"]["shop_item_kind"] }
        Returns: undefined
      }
      transfer_room_ownership: {
        Args: { _new_owner: string; _room: string }
        Returns: undefined
      }
      unban_room_member: {
        Args: { _room: string; _user: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      community_post_kind: "text" | "image" | "video" | "mixed"
      community_reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry"
      community_report_status: "open" | "reviewed" | "dismissed"
      friendship_status: "pending" | "accepted" | "blocked"
      message_type: "text" | "image" | "voice" | "system"
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
      room_rank: "owner" | "admin" | "moderator" | "member"
      shop_item_kind: "badge" | "name_color" | "chat_color" | "effect"
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
      community_post_kind: ["text", "image", "video", "mixed"],
      community_reaction: ["like", "love", "haha", "wow", "sad", "angry"],
      community_report_status: ["open", "reviewed", "dismissed"],
      friendship_status: ["pending", "accepted", "blocked"],
      message_type: ["text", "image", "voice", "system"],
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
      room_rank: ["owner", "admin", "moderator", "member"],
      shop_item_kind: ["badge", "name_color", "chat_color", "effect"],
    },
  },
} as const
