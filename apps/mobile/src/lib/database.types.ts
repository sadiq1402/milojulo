
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activities": {
                  Row: {
                    "area_id": string,"capacity": number,"circle_id": string | null,"created_at": string,"description": string | null,"ends_at": string | null,"hidden_at": string | null,"host_id": string,"id": string,"starts_at": string,"status": Database["public"]['Enums']["activity_status"],"title": string,"type": Database["public"]['Enums']["activity_type"],"activity_ends_at": string | null
                  }
                  ComputedFields: "activity_ends_at"
                  Insert: {
                    "area_id": string,"capacity": number,"circle_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"hidden_at"?: string | null,"host_id": string,"id"?: string,"starts_at": string,"status"?: Database["public"]['Enums']["activity_status"],"title": string,"type": Database["public"]['Enums']["activity_type"]
                  }
                  Update: {
                    "area_id"?: string,"capacity"?: number,"circle_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string | null,"hidden_at"?: string | null,"host_id"?: string,"id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["activity_status"],"title"?: string,"type"?: Database["public"]['Enums']["activity_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_requests": {
                  Row: {
                    "activity_id": string,"created_at": string,"id": string,"requester_id": string,"responded_at": string | null,"status": Database["public"]['Enums']["request_status"],"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"created_at"?: string,"id"?: string,"requester_id": string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"withdrawn_at"?: string | null
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string,"id"?: string,"requester_id"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["request_status"],"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_requests_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_venues": {
                  Row: {
                    "activity_id": string,"created_at": string,"venue_detail": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"created_at"?: string,"venue_detail": string
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string,"venue_detail"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_venues_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: true
      referencedRelation: "activities"
      referencedColumns: ["id"]
    }
                  ]
                },"areas": {
                  Row: {
                    "center": unknown,"created_at": string,"id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "center": unknown,"created_at"?: string,"id": string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "center"?: unknown,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"banned_terms": {
                  Row: {
                    "term": string
                  }
                  ComputedFields: never
                  Insert: {
                    "term": string
                  }
                  Update: {
                    "term"?: string
                  }
                  Relationships: [
                    
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_uploads": {
                  Row: {
                    "confirmed_at": string | null,"connection_id": string,"created_at": string,"id": string,"kind": Database["public"]['Enums']["message_type"],"media_key": string,"mime": string,"sender_id": string,"size": number,"used_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string | null,"connection_id": string,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["message_type"],"media_key": string,"mime": string,"sender_id": string,"size": number,"used_at"?: string | null
                  }
                  Update: {
                    "confirmed_at"?: string | null,"connection_id"?: string,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["message_type"],"media_key"?: string,"mime"?: string,"sender_id"?: string,"size"?: number,"used_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_uploads_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_uploads_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circle_members": {
                  Row: {
                    "circle_id": string,"joined_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "circle_id": string,"joined_at"?: string,"user_id": string
                  }
                  Update: {
                    "circle_id"?: string,"joined_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "circle_members_circle_id_fkey"
      columns: ["circle_id"]
isOneToOne: false
      referencedRelation: "circles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circle_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"circles": {
                  Row: {
                    "area_id": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_active": boolean,"name": string,"tag_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"tag_id": number
                  }
                  Update: {
                    "area_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"tag_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "circles_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "circles_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_members": {
                  Row: {
                    "connection_id": string,"created_at": string,"last_read_at": string | null,"media_consent": boolean,"muted": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"created_at"?: string,"last_read_at"?: string | null,"media_consent"?: boolean,"muted"?: boolean,"user_id": string
                  }
                  Update: {
                    "connection_id"?: string,"created_at"?: string,"last_read_at"?: string | null,"media_consent"?: boolean,"muted"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_members_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_mode_changes": {
                  Row: {
                    "connection_id": string,"decided_at": string | null,"from_mode": Database["public"]['Enums']["mode"],"id": string,"outcome": Database["public"]['Enums']["mode_change_outcome"] | null,"proposed_at": string,"proposed_by": string | null,"to_mode": Database["public"]['Enums']["mode"]
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"decided_at"?: string | null,"from_mode": Database["public"]['Enums']["mode"],"id"?: string,"outcome"?: Database["public"]['Enums']["mode_change_outcome"] | null,"proposed_at"?: string,"proposed_by"?: string | null,"to_mode": Database["public"]['Enums']["mode"]
                  }
                  Update: {
                    "connection_id"?: string,"decided_at"?: string | null,"from_mode"?: Database["public"]['Enums']["mode"],"id"?: string,"outcome"?: Database["public"]['Enums']["mode_change_outcome"] | null,"proposed_at"?: string,"proposed_by"?: string | null,"to_mode"?: Database["public"]['Enums']["mode"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_mode_changes_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_mode_changes_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"connections": {
                  Row: {
                    "activity_id": string | null,"addressee_id": string,"closed_at": string | null,"closed_by": string | null,"created_at": string,"id": string,"mode": Database["public"]['Enums']["mode"],"note": string | null,"requester_id": string,"responded_at": string | null,"status": Database["public"]['Enums']["connection_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"addressee_id": string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"id"?: string,"mode": Database["public"]['Enums']["mode"],"note"?: string | null,"requester_id": string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["connection_status"]
                  }
                  Update: {
                    "activity_id"?: string | null,"addressee_id"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"id"?: string,"mode"?: Database["public"]['Enums']["mode"],"note"?: string | null,"requester_id"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["connection_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "connections_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connections_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connections_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connections_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_documents": {
                  Row: {
                    "created_at": string,"effective_at": string,"id": string,"kind": Database["public"]['Enums']["consent_kind"],"url": string | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"effective_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["consent_kind"],"url"?: string | null,"version": string
                  }
                  Update: {
                    "created_at"?: string,"effective_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["consent_kind"],"url"?: string | null,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "accepted_at": string,"created_at": string,"document_id": string,"user_id": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"created_at"?: string,"document_id": string,"user_id": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string,"created_at"?: string,"document_id"?: string,"user_id"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "consent_documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"data_requests": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["data_request_kind"],"status": Database["public"]['Enums']["data_request_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["data_request_kind"],"status"?: Database["public"]['Enums']["data_request_status"],"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["data_request_kind"],"status"?: Database["public"]['Enums']["data_request_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"industries": {
                  Row: {
                    "created_at": string,"id": number,"is_active": boolean,"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"is_active"?: boolean,"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"is_active"?: boolean,"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"meetup_feedback": {
                  Row: {
                    "activity_id": string | null,"created_at": string,"did_meet": boolean,"id": string,"keep": boolean,"other_user_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"created_at"?: string,"did_meet": boolean,"id"?: string,"keep": boolean,"other_user_id": string,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string | null,"created_at"?: string,"did_meet"?: boolean,"id"?: string,"keep"?: boolean,"other_user_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetup_feedback_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_feedback_other_user_id_fkey"
      columns: ["other_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "activity_id": string | null,"body": string | null,"connection_id": string,"created_at": string,"id": string,"media_deleted_at": string | null,"media_duration_ms": number | null,"media_height": number | null,"media_key": string | null,"media_mime": string | null,"media_width": number | null,"removed_at": string | null,"sender_id": string,"type": Database["public"]['Enums']["message_type"],"message_evidence": Json | null
                  }
                  ComputedFields: "message_evidence"
                  Insert: {
                    "activity_id"?: string | null,"body"?: string | null,"connection_id": string,"created_at"?: string,"id": string,"media_deleted_at"?: string | null,"media_duration_ms"?: number | null,"media_height"?: number | null,"media_key"?: string | null,"media_mime"?: string | null,"media_width"?: number | null,"removed_at"?: string | null,"sender_id"?: string,"type": Database["public"]['Enums']["message_type"]
                  }
                  Update: {
                    "activity_id"?: string | null,"body"?: string | null,"connection_id"?: string,"created_at"?: string,"id"?: string,"media_deleted_at"?: string | null,"media_duration_ms"?: number | null,"media_height"?: number | null,"media_key"?: string | null,"media_mime"?: string | null,"media_width"?: number | null,"removed_at"?: string | null,"sender_id"?: string,"type"?: Database["public"]['Enums']["message_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"photo_uploads": {
                  Row: {
                    "created_at": string,"id": string,"object_key": string,"position": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"object_key": string,"position": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"object_key"?: string,"position"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "photo_uploads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "created_at": string,"height": number | null,"hidden_at": string | null,"id": string,"object_key": string,"position": number,"provider": string,"removed_at": string | null,"removed_by": string | null,"uploaded_at": string | null,"user_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height"?: number | null,"hidden_at"?: string | null,"id"?: string,"object_key": string,"position": number,"provider"?: string,"removed_at"?: string | null,"removed_by"?: string | null,"uploaded_at"?: string | null,"user_id": string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"height"?: number | null,"hidden_at"?: string | null,"id"?: string,"object_key"?: string,"position"?: number,"provider"?: string,"removed_at"?: string | null,"removed_by"?: string | null,"uploaded_at"?: string | null,"user_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_prompts": {
                  Row: {
                    "answer": string,"created_at": string,"position": number,"question_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": string,"created_at"?: string,"position": number,"question_id": number,"user_id": string
                  }
                  Update: {
                    "answer"?: string,"created_at"?: string,"position"?: number,"question_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_prompts_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "prompt_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_prompts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_tags": {
                  Row: {
                    "created_at": string,"tag_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"tag_id": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"tag_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_tags_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "area_id": string | null,"availability": (Database["public"]['Enums']["availability_slot"])[],"banned_at": string | null,"banned_reason": string | null,"career_stage": Database["public"]['Enums']["career_stage"] | null,"created_at": string,"date_of_birth": string | null,"deleted_at": string | null,"display_name": string | null,"gender": Database["public"]['Enums']["gender"] | null,"hidden_at": string | null,"id": string,"industry_id": number | null,"modes": (Database["public"]['Enums']["mode"])[],"paused_at": string | null,"pref_age_max": number | null,"pref_age_min": number | null,"pref_genders": (Database["public"]['Enums']["gender"])[] | null,"pref_max_km": number | null,"profession": string | null,"status": Database["public"]['Enums']["account_status"],"submitted_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"availability"?: (Database["public"]['Enums']["availability_slot"])[],"banned_at"?: string | null,"banned_reason"?: string | null,"career_stage"?: Database["public"]['Enums']["career_stage"] | null,"created_at"?: string,"date_of_birth"?: string | null,"deleted_at"?: string | null,"display_name"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"hidden_at"?: string | null,"id": string,"industry_id"?: number | null,"modes"?: (Database["public"]['Enums']["mode"])[],"paused_at"?: string | null,"pref_age_max"?: number | null,"pref_age_min"?: number | null,"pref_genders"?: (Database["public"]['Enums']["gender"])[] | null,"pref_max_km"?: number | null,"profession"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"submitted_at"?: string | null
                  }
                  Update: {
                    "area_id"?: string | null,"availability"?: (Database["public"]['Enums']["availability_slot"])[],"banned_at"?: string | null,"banned_reason"?: string | null,"career_stage"?: Database["public"]['Enums']["career_stage"] | null,"created_at"?: string,"date_of_birth"?: string | null,"deleted_at"?: string | null,"display_name"?: string | null,"gender"?: Database["public"]['Enums']["gender"] | null,"hidden_at"?: string | null,"id"?: string,"industry_id"?: number | null,"modes"?: (Database["public"]['Enums']["mode"])[],"paused_at"?: string | null,"pref_age_max"?: number | null,"pref_age_min"?: number | null,"pref_genders"?: (Database["public"]['Enums']["gender"])[] | null,"pref_max_km"?: number | null,"profession"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"submitted_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_industry_id_fkey"
      columns: ["industry_id"]
isOneToOne: false
      referencedRelation: "industries"
      referencedColumns: ["id"]
    }
                  ]
                },"prompt_questions": {
                  Row: {
                    "created_at": string,"id": number,"is_active": boolean,"sort_order": number,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"is_active"?: boolean,"sort_order"?: number,"text": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"is_active"?: boolean,"sort_order"?: number,"text"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string | null,"evidence": Json | null,"evidence_media_key": string | null,"handled_at": string | null,"handled_by": string | null,"id": string,"internal_note": string | null,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string | null,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"],"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string | null,"evidence"?: Json | null,"evidence_media_key"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"internal_note"?: string | null,"reason": Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"],"target_user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: string | null,"evidence"?: Json | null,"evidence_media_key"?: string | null,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"internal_note"?: string | null,"reason"?: Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"],"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"id": number,"is_active": boolean,"kind": Database["public"]['Enums']["tag_kind"],"label": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"is_active"?: boolean,"kind": Database["public"]['Enums']["tag_kind"],"label": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["tag_kind"],"label"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_consents":
{ Args: { "birth_date": string,"document_ids": (string)[] }; Returns: undefined
                           },
"accepted_connection_id":
{ Args: { "a": string,"b": string }; Returns: string
                           },
"active_connection_id":
{ Args: { "a": string,"b": string }; Returns: string
                           },
"activity_board":
{ Args: Record<PropertyKey, never>; Returns: {
              "area_id": string,"capacity": number,"circle_id": string,"circle_name": string,"description": string,"ends_at": string,"host_id": string,"host_name": string,"id": string,"is_mine": boolean,"spots_left": number,"starts_at": string,"starts_when": string,"title": string,"type": Database["public"]['Enums']["activity_type"]
            }[]
                           },
"activity_ends_at":
{ Args: { "activity": Omit<Database["public"]['Tables']["activities"]['Row'], Database["public"]['Tables']["activities"]['ComputedFields']> }; Returns: string
                           },
"activity_feedback_pairs":
{ Args: { "member_id": string }; Returns: {
              "activity_id": string,"activity_title": string,"ends_at": string,"other_user_id": string
            }[]
                           },
"activity_is_locked":
{ Args: { "activity_id": string }; Returns: boolean
                           },
"activity_join_requests":
{ Args: { "activity_id": string }; Returns: {
              "connection_id": string,"created_at": string,"request_id": string,"requester_area_id": string,"requester_id": string,"requester_name": string,"requester_photo_id": string,"status": Database["public"]['Enums']["request_status"]
            }[]
                           },
"activity_spots_left":
{ Args: { "activity_id": string }; Returns: number
                           },
"activity_starts_when":
{ Args: { "starts_at": string }; Returns: string
                           },
"admin_archive_circle":
{ Args: { "circle_id": string }; Returns: undefined
                           },
"admin_create_circle":
{ Args: { "area_id": string,"description": string,"name": string,"tag_id": number }; Returns: string
                           },
"admin_edit_circle":
{ Args: { "area_id": string,"circle_id": string,"description": string,"name": string,"tag_id": number }; Returns: undefined
                           },
"age_of":
{ Args: { "birth_date": string }; Returns: number
                           },
"block_user":
{ Args: { "member_id": string }; Returns: undefined
                           },
"browse_circles":
{ Args: Record<PropertyKey, never>; Returns: {
              "area_id": string,"circle_id": string,"description": string,"i_am_member": boolean,"member_count": number,"name": string,"tag_id": number
            }[]
                           },
"can_give_feedback_about":
{ Args: { "member_id": string,"other_id": string }; Returns: boolean
                           },
"can_see_activity":
{ Args: { "activity": Omit<Database["public"]['Tables']["activities"]['Row'], Database["public"]['Tables']["activities"]['ComputedFields']>,"viewer": string }; Returns: boolean
                           },
"can_send_in":
{ Args: { "connection_id": string }; Returns: boolean
                           },
"cancel_activity":
{ Args: { "activity_id": string }; Returns: undefined
                           },
"chat_media_format":
{ Args: { "kind": Database["public"]['Enums']["message_type"] }; Returns: Record<string, unknown>
                           },
"chat_media_links":
{ Args: { "message_ids": (string)[],"viewer": string }; Returns: {
              "media_key": string,"message_id": string
            }[]
                           },
"chat_media_state":
{ Args: { "connection_id": string }; Returns: {
              "is_casual": boolean,"mine": boolean,"theirs": boolean
            }[]
                           },
"check_activity":
{ Args: { "capacity": number,"ends_at": string,"start_changed": boolean,"starts_at": string,"title": string }; Returns: undefined
                           },
"check_photo_uploader":
{ Args: { "member_id": string }; Returns: undefined
                           },
"circle_activities":
{ Args: { "circle_id": string }; Returns: {
              "area_id": string,"capacity": number,"circle_id": string,"circle_name": string,"description": string,"ends_at": string,"host_id": string,"host_name": string,"id": string,"is_mine": boolean,"spots_left": number,"starts_at": string,"starts_when": string,"title": string,"type": Database["public"]['Enums']["activity_type"]
            }[]
                           },
"circle_members_of":
{ Args: { "circle_id": string }; Returns: {
              "area_id": string,"cover_photo_id": string,"display_name": string,"member_id": string
            }[]
                           },
"close_connection":
{ Args: { "connection_id": string }; Returns: undefined
                           },
"confirm_chat_upload":
{ Args: { "member_id": string,"upload_id": string }; Returns: string
                           },
"confirm_photo_upload":
{ Args: { "member_id": string,"upload_id": string }; Returns: string
                           },
"consent_withdrawn":
{ Args: { "member_id": string }; Returns: boolean
                           },
"cover_photo_id":
{ Args: { "member_id": string }; Returns: string
                           },
"current_consent_documents":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"delete_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"delete_photo":
{ Args: { "member_id": string,"photo_id": string }; Returns: string
                           },
"discover_feed":
{ Args: { "after"?: string,"mode_filter"?: Database["public"]['Enums']["mode"],"page_size"?: number }; Returns: {
              "age": number,"area_id": string,"cover_photo_id": string,"cursor": string,"display_name": string,"modes": (Database["public"]['Enums']["mode"])[],"shared_tag_ids": (number)[],"user_id": string,"why_you_match": string
            }[]
                           },
"eligible_modes":
{ Args: { "a": string,"b": string }; Returns: (Database["public"]['Enums']["mode"])[]
                           },
"english_list":
{ Args: { "items": (string)[] }; Returns: string
                           },
"expire_activities":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"fits_dating_preferences":
{ Args: { "candidate": string,"seeker": string }; Returns: boolean
                           },
"get_activity":
{ Args: { "activity_id": string }; Returns: {
              "area_id": string,"capacity": number,"circle_id": string,"circle_name": string,"connection_id": string,"description": string,"ends_at": string,"host_id": string,"host_name": string,"id": string,"is_locked": boolean,"is_mine": boolean,"my_request_id": string,"my_request_status": Database["public"]['Enums']["request_status"],"spots_left": number,"starts_at": string,"starts_when": string,"status": Database["public"]['Enums']["activity_status"],"title": string,"type": Database["public"]['Enums']["activity_type"],"venue_detail": string
            }[]
                           },
"get_circle":
{ Args: { "circle_id": string }; Returns: {
              "area_id": string,"circle_id": string,"description": string,"i_am_member": boolean,"member_count": number,"name": string,"tag_id": number
            }[]
                           },
"get_profile":
{ Args: { "member_id": string }; Returns: {
              "age": number,"area_id": string,"availability": (Database["public"]['Enums']["availability_slot"])[],"display_name": string,"modes": (Database["public"]['Enums']["mode"])[],"photo_ids": (string)[],"prompts": Json,"tag_ids": (number)[],"user_id": string,"why_you_match": string
            }[]
                           },
"hosts_activity":
{ Args: { "activity_id": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked":
{ Args: { "a": string,"b": string }; Returns: boolean
                           },
"is_circle_member":
{ Args: { "circle_id": string,"member_id": string }; Returns: boolean
                           },
"is_reachable":
{ Args: { "member_id": string }; Returns: boolean
                           },
"is_visible":
{ Args: { "member_id": string }; Returns: boolean
                           },
"join_activity_request":
{ Args: { "activity_id": string }; Returns: string
                           },
"join_circle":
{ Args: { "circle_id": string }; Returns: undefined
                           },
"kept_connections":
{ Args: { "since": string }; Returns: {
              "kept_at": string,"user_a": string,"user_b": string
            }[]
                           },
"leave_circle":
{ Args: { "circle_id": string }; Returns: undefined
                           },
"match_reason":
{ Args: { "a": string,"b": string }; Returns: string
                           },
"matches_banned_term":
{ Args: { "content": string }; Returns: boolean
                           },
"media_allowed":
{ Args: { "connection_id": string }; Returns: boolean
                           },
"message_evidence":
{ Args: { "m": Omit<Database["public"]['Tables']["messages"]['Row'], Database["public"]['Tables']["messages"]['ComputedFields']> }; Returns: Json
                           },
"move_photo":
{ Args: { "new_position": number,"photo_id": string }; Returns: undefined
                           },
"my_blocks":
{ Args: Record<PropertyKey, never>; Returns: {
              "blocked_at": string,"display_name": string,"member_id": string
            }[]
                           },
"my_connections":
{ Args: Record<PropertyKey, never>; Returns: {
              "connection_id": string,"direction": Database["public"]['Enums']["connection_direction"],"last_message_at": string,"last_message_body": string,"last_message_type": Database["public"]['Enums']["message_type"],"mode": Database["public"]['Enums']["mode"],"note": string,"other_area_id": string,"other_id": string,"other_name": string,"other_photo_id": string,"status": Database["public"]['Enums']["connection_status"],"unread_count": number
            }[]
                           },
"my_join_requests":
{ Args: Record<PropertyKey, never>; Returns: {
              "activity_id": string,"activity_starts_at": string,"activity_title": string,"created_at": string,"direction": Database["public"]['Enums']["connection_direction"],"other_id": string,"other_name": string,"other_photo_id": string,"request_id": string
            }[]
                           },
"pending_chat_upload":
{ Args: { "member_id": string,"upload_id": string }; Returns: {
              "media_key": string,"mime": string,"size": number,"upload_key": string
            }[]
                           },
"pending_meetup_feedback":
{ Args: Record<PropertyKey, never>; Returns: {
              "activity_id": string,"activity_title": string,"cover_photo_id": string,"display_name": string,"ends_at": string,"other_user_id": string
            }[]
                           },
"pending_photo_upload":
{ Args: { "member_id": string,"upload_id": string }; Returns: {
              "object_key": string,"upload_key": string
            }[]
                           },
"photo_links":
{ Args: { "photo_ids": (string)[],"viewer": string }; Returns: {
              "object_key": string,"photo_id": string
            }[]
                           },
"post_activity":
{ Args: { "area_id": string,"capacity"?: number,"circle_id"?: string,"description"?: string,"ends_at"?: string,"starts_at": string,"title": string,"type": Database["public"]['Enums']["activity_type"],"venue_detail"?: string }; Returns: string
                           },
"profile_minimum_gap":
{ Args: { "member_id": string }; Returns: string
                           },
"propose_mode_change":
{ Args: { "connection_id": string,"to_mode": Database["public"]['Enums']["mode"] }; Returns: string
                           },
"report":
{ Args: { "details"?: string,"reason": Database["public"]['Enums']["report_reason"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"] }; Returns: undefined
                           },
"request_data_copy":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"respond_activity_request":
{ Args: { "accept": boolean,"request_id": string }; Returns: string
                           },
"respond_mode_change":
{ Args: { "accept": boolean,"change_id": string }; Returns: undefined
                           },
"respond_request":
{ Args: { "accept": boolean,"connection_id": string }; Returns: undefined
                           },
"seed_reviewer":
{ Args: { "reviewer_id": string }; Returns: undefined
                           },
"send_request":
{ Args: { "mode": Database["public"]['Enums']["mode"],"note"?: string,"to_member": string }; Returns: string
                           },
"set_media_consent":
{ Args: { "connection_id": string,"consent": boolean }; Returns: undefined
                           },
"set_paused":
{ Args: { "paused": boolean }; Returns: undefined
                           },
"shared_tags":
{ Args: { "a": string,"b": string }; Returns: {
              "created_at": string,
"id": number,
"is_active": boolean,
"kind": Database["public"]['Enums']["tag_kind"],
"label": string,
"slug": string,
"sort_order": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "tags"
        isOneToOne: false
        isSetofReturn: true
      } },
"shares_photos_with":
{ Args: { "member_id": string,"viewer": string }; Returns: boolean
                           },
"start_chat_upload":
{ Args: { "connection_id": string,"kind": Database["public"]['Enums']["message_type"],"member_id": string,"size": number }; Returns: {
              "upload_id": string,"upload_key": string
            }[]
                           },
"start_photo_upload":
{ Args: { "member_id": string,"photo_position": number }; Returns: {
              "discarded_keys": (string)[],"object_key": string,"photo_id": string,"upload_key": string
            }[]
                           },
"submit_meetup_feedback":
{ Args: { "activity"?: string,"did_meet": boolean,"keep": boolean,"other_user": string }; Returns: undefined
                           },
"submit_profile":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"update_activity":
{ Args: { "activity_id": string,"area_id"?: string,"capacity"?: number,"description"?: string,"ends_at"?: string,"starts_at"?: string,"title"?: string,"venue_detail"?: string }; Returns: undefined
                           },
"withdraw_activity_request":
{ Args: { "request_id": string }; Returns: undefined
                           },
"withdraw_consent":
{ Args: { "document_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "active"|"banned","activity_status": "open"|"cancelled"|"expired"|"removed","activity_type": "sports"|"food_chai"|"outdoors"|"games"|"learning","availability_slot": "weekday_evenings"|"weekends"|"early_mornings","career_stage": "student"|"early"|"mid"|"senior"|"founder","connection_direction": "incoming"|"outgoing","connection_status": "requested"|"accepted"|"declined"|"closed","consent_kind": "terms"|"guidelines"|"data_notice","data_request_kind": "access"|"erasure","data_request_status": "pending"|"done","gender": "woman"|"man"|"nonbinary","message_type": "text"|"image"|"video"|"voice"|"activity_card","mode": "friends"|"activities"|"networking"|"dating"|"serious"|"casual","mode_change_outcome": "accepted"|"declined"|"lapsed","report_reason": "fake_or_spam"|"harassment"|"inappropriate_content"|"underage"|"felt_unsafe"|"other"|"word_filter","report_status": "open"|"actioned"|"dismissed","report_target": "profile"|"message"|"activity"|"photo","request_status": "requested"|"accepted"|"declined"|"cancelled"|"withdrawn","tag_kind": "interest"|"activity"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["active", "banned"],"activity_status": ["open", "cancelled", "expired", "removed"],"activity_type": ["sports", "food_chai", "outdoors", "games", "learning"],"availability_slot": ["weekday_evenings", "weekends", "early_mornings"],"career_stage": ["student", "early", "mid", "senior", "founder"],"connection_direction": ["incoming", "outgoing"],"connection_status": ["requested", "accepted", "declined", "closed"],"consent_kind": ["terms", "guidelines", "data_notice"],"data_request_kind": ["access", "erasure"],"data_request_status": ["pending", "done"],"gender": ["woman", "man", "nonbinary"],"message_type": ["text", "image", "video", "voice", "activity_card"],"mode": ["friends", "activities", "networking", "dating", "serious", "casual"],"mode_change_outcome": ["accepted", "declined", "lapsed"],"report_reason": ["fake_or_spam", "harassment", "inappropriate_content", "underage", "felt_unsafe", "other", "word_filter"],"report_status": ["open", "actioned", "dismissed"],"report_target": ["profile", "message", "activity", "photo"],"request_status": ["requested", "accepted", "declined", "cancelled", "withdrawn"],"tag_kind": ["interest", "activity"]
          }
        }
} as const
