
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
                    "avg_hr": number | null,"calories_kcal": number | null,"created_at": string,"distance_m": number | null,"elapsed_s": number | null,"elevation_gain_m": number | null,"external_id": string | null,"fit_file_path": string | null,"fit_locked": boolean,"hr_histogram": Json | null,"hr_zone_s": (number)[] | null,"id": string,"load": number | null,"local_date": string,"max_hr": number | null,"max_hr_source": string | null,"max_hr_used": number | null,"moving_s": number | null,"occurred_at": string,"source_name": string | null,"sources": (string)[],"sport": string,"sub_sport": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avg_hr"?: number | null,"calories_kcal"?: number | null,"created_at"?: string,"distance_m"?: number | null,"elapsed_s"?: number | null,"elevation_gain_m"?: number | null,"external_id"?: string | null,"fit_file_path"?: string | null,"fit_locked"?: boolean,"hr_histogram"?: Json | null,"hr_zone_s"?: (number)[] | null,"id"?: string,"load"?: number | null,"local_date": string,"max_hr"?: number | null,"max_hr_source"?: string | null,"max_hr_used"?: number | null,"moving_s"?: number | null,"occurred_at": string,"source_name"?: string | null,"sources"?: (string)[],"sport": string,"sub_sport"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "avg_hr"?: number | null,"calories_kcal"?: number | null,"created_at"?: string,"distance_m"?: number | null,"elapsed_s"?: number | null,"elevation_gain_m"?: number | null,"external_id"?: string | null,"fit_file_path"?: string | null,"fit_locked"?: boolean,"hr_histogram"?: Json | null,"hr_zone_s"?: (number)[] | null,"id"?: string,"load"?: number | null,"local_date"?: string,"max_hr"?: number | null,"max_hr_source"?: string | null,"max_hr_used"?: number | null,"moving_s"?: number | null,"occurred_at"?: string,"source_name"?: string | null,"sources"?: (string)[],"sport"?: string,"sub_sport"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"activity_splits": {
                  Row: {
                    "activity_id": string,"avg_hr": number | null,"distance_m": number,"duration_s": number,"elev_delta_m": number | null,"idx": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"avg_hr"?: number | null,"distance_m": number,"duration_s": number,"elev_delta_m"?: number | null,"idx": number,"user_id"?: string
                  }
                  Update: {
                    "activity_id"?: string,"avg_hr"?: number | null,"distance_m"?: number,"duration_s"?: number,"elev_delta_m"?: number | null,"idx"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_splits_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    }
                  ]
                },"body_composition_tests": {
                  Row: {
                    "bmr_kcal": number | null,"body_fat_pct": number | null,"created_at": string,"derived_fields": (string)[],"document_path": string | null,"fat_mass_kg": number | null,"id": string,"lean_mass_kg": number | null,"local_date": string,"method": Database["public"]['Enums']["body_comp_method"],"occurred_at": string,"segmental_lean": Json | null,"skeletal_muscle_kg": number | null,"source": string,"total_body_water_kg": number | null,"updated_at": string,"user_id": string,"visceral_fat_level": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bmr_kcal"?: number | null,"body_fat_pct"?: number | null,"created_at"?: string,"derived_fields"?: (string)[],"document_path"?: string | null,"fat_mass_kg"?: number | null,"id"?: string,"lean_mass_kg"?: number | null,"local_date": string,"method": Database["public"]['Enums']["body_comp_method"],"occurred_at": string,"segmental_lean"?: Json | null,"skeletal_muscle_kg"?: number | null,"source"?: string,"total_body_water_kg"?: number | null,"updated_at"?: string,"user_id"?: string,"visceral_fat_level"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "bmr_kcal"?: number | null,"body_fat_pct"?: number | null,"created_at"?: string,"derived_fields"?: (string)[],"document_path"?: string | null,"fat_mass_kg"?: number | null,"id"?: string,"lean_mass_kg"?: number | null,"local_date"?: string,"method"?: Database["public"]['Enums']["body_comp_method"],"occurred_at"?: string,"segmental_lean"?: Json | null,"skeletal_muscle_kg"?: number | null,"source"?: string,"total_body_water_kg"?: number | null,"updated_at"?: string,"user_id"?: string,"visceral_fat_level"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"body_goals": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"goal_body_fat_pct": number | null,"goal_weight_kg": number | null,"id": string,"local_date": string,"occurred_at": string,"status": Database["public"]['Enums']["goal_status"],"target_date": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"goal_body_fat_pct"?: number | null,"goal_weight_kg"?: number | null,"id"?: string,"local_date": string,"occurred_at": string,"status"?: Database["public"]['Enums']["goal_status"],"target_date"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"goal_body_fat_pct"?: number | null,"goal_weight_kg"?: number | null,"id"?: string,"local_date"?: string,"occurred_at"?: string,"status"?: Database["public"]['Enums']["goal_status"],"target_date"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"body_measurements": {
                  Row: {
                    "arm_cm": number | null,"chest_cm": number | null,"created_at": string,"hips_cm": number | null,"id": string,"local_date": string,"occurred_at": string,"thigh_cm": number | null,"updated_at": string,"user_id": string,"waist_cm": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arm_cm"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"hips_cm"?: number | null,"id"?: string,"local_date": string,"occurred_at": string,"thigh_cm"?: number | null,"updated_at"?: string,"user_id"?: string,"waist_cm"?: number | null
                  }
                  Update: {
                    "arm_cm"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"hips_cm"?: number | null,"id"?: string,"local_date"?: string,"occurred_at"?: string,"thigh_cm"?: number | null,"updated_at"?: string,"user_id"?: string,"waist_cm"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"body_weights": {
                  Row: {
                    "created_at": string,"id": string,"local_date": string,"occurred_at": string,"updated_at": string,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"local_date": string,"occurred_at": string,"updated_at"?: string,"user_id"?: string,"weight_kg": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"local_date"?: string,"occurred_at"?: string,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    
                  ]
                },"daily_metrics": {
                  Row: {
                    "active_energy_kcal": number | null,"created_at": string,"hrv_sdnn_ms": number | null,"id": string,"local_date": string,"occurred_at": string,"resting_hr_bpm": number | null,"sleep_end": string | null,"sleep_minutes": number | null,"sleep_start": string | null,"source": string,"steps": number | null,"updated_at": string,"user_id": string,"vo2max": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_energy_kcal"?: number | null,"created_at"?: string,"hrv_sdnn_ms"?: number | null,"id"?: string,"local_date": string,"occurred_at": string,"resting_hr_bpm"?: number | null,"sleep_end"?: string | null,"sleep_minutes"?: number | null,"sleep_start"?: string | null,"source"?: string,"steps"?: number | null,"updated_at"?: string,"user_id"?: string,"vo2max"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "active_energy_kcal"?: number | null,"created_at"?: string,"hrv_sdnn_ms"?: number | null,"id"?: string,"local_date"?: string,"occurred_at"?: string,"resting_hr_bpm"?: number | null,"sleep_end"?: string | null,"sleep_minutes"?: number | null,"sleep_start"?: string | null,"source"?: string,"steps"?: number | null,"updated_at"?: string,"user_id"?: string,"vo2max"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"daily_nutrition_targets": {
                  Row: {
                    "components": NonNullable<Json>,"computed_at": string,"created_at": string,"id": string,"local_date": string,"method": string,"targets": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "components": NonNullable<Json>,"computed_at"?: string,"created_at"?: string,"id"?: string,"local_date": string,"method": string,"targets": NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "components"?: NonNullable<Json>,"computed_at"?: string,"created_at"?: string,"id"?: string,"local_date"?: string,"method"?: string,"targets"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exercise_aliases": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"phrase_normalised": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id"?: string,"phrase_normalised": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"phrase_normalised"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_aliases_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_muscles": {
                  Row: {
                    "exercise_id": string,"muscle_group": Database["public"]['Enums']["muscle_group"],"role": Database["public"]['Enums']["muscle_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"muscle_group": Database["public"]['Enums']["muscle_group"],"role": Database["public"]['Enums']["muscle_role"]
                  }
                  Update: {
                    "exercise_id"?: string,"muscle_group"?: Database["public"]['Enums']["muscle_group"],"role"?: Database["public"]['Enums']["muscle_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_muscles_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercise_settings": {
                  Row: {
                    "created_at": string,"duration_increment_s": number | null,"exercise_id": string,"id": string,"increment_kg": number | null,"rep_max": number | null,"rep_min": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_increment_s"?: number | null,"exercise_id": string,"id"?: string,"increment_kg"?: number | null,"rep_max"?: number | null,"rep_min"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"duration_increment_s"?: number | null,"exercise_id"?: string,"id"?: string,"increment_kg"?: number | null,"rep_max"?: number | null,"rep_min"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercise_settings_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "archived_at": string | null,"category": string | null,"created_at": string,"equipment": string | null,"force": string | null,"id": string,"image_paths": (string)[],"instructions": (string)[],"level": string | null,"mechanic": string | null,"name": string,"search_name": string,"source_id": string | null,"tracking_mode": Database["public"]['Enums']["tracking_mode"],"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category"?: string | null,"created_at"?: string,"equipment"?: string | null,"force"?: string | null,"id"?: string,"image_paths"?: (string)[],"instructions"?: (string)[],"level"?: string | null,"mechanic"?: string | null,"name": string,"search_name": string,"source_id"?: string | null,"tracking_mode": Database["public"]['Enums']["tracking_mode"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: string | null,"created_at"?: string,"equipment"?: string | null,"force"?: string | null,"id"?: string,"image_paths"?: (string)[],"instructions"?: (string)[],"level"?: string | null,"mechanic"?: string | null,"name"?: string,"search_name"?: string,"source_id"?: string | null,"tracking_mode"?: Database["public"]['Enums']["tracking_mode"],"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"food_log_days": {
                  Row: {
                    "created_at": string,"id": string,"is_complete": boolean,"local_date": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_complete"?: boolean,"local_date": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_complete"?: boolean,"local_date"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"food_lookup_cache": {
                  Row: {
                    "fetched_at": string,"payload": NonNullable<Json>,"query_normalized": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fetched_at"?: string,"payload": NonNullable<Json>,"query_normalized": string,"source": string
                  }
                  Update: {
                    "fetched_at"?: string,"payload"?: NonNullable<Json>,"query_normalized"?: string,"source"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ingest_rate": {
                  Row: {
                    "count": number,"token_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"token_id": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"token_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingest_rate_token_id_fkey"
      columns: ["token_id"]
isOneToOne: false
      referencedRelation: "ingest_tokens"
      referencedColumns: ["id"]
    }
                  ]
                },"ingest_tokens": {
                  Row: {
                    "created_at": string,"id": string,"last_result": Json | null,"last_used_at": string | null,"last4": string,"prefix": string,"revoked_at": string | null,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_result"?: Json | null,"last_used_at"?: string | null,"last4": string,"prefix": string,"revoked_at"?: string | null,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_result"?: Json | null,"last_used_at"?: string | null,"last4"?: string,"prefix"?: string,"revoked_at"?: string | null,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"meal_items": {
                  Row: {
                    "b12_ug": number | null,"calcium_mg": number | null,"carb_g": number,"confidence": string | null,"created_at": string,"fat_g": number,"fiber_g": number | null,"grams": number,"id": string,"iron_mg": number | null,"kcal": number,"magnesium_mg": number | null,"matched_name": string | null,"meal_id": string,"name": string,"nutrient_source": Database["public"]['Enums']["nutrient_source"],"per100g": NonNullable<Json>,"position": number,"potassium_mg": number | null,"preparation": string | null,"protein_g": number,"quantity_source": string,"satfat_g": number | null,"sodium_mg": number | null,"source_ref": string | null,"sugar_g": number | null,"updated_at": string,"user_id": string,"vitamin_d_ug": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "b12_ug"?: number | null,"calcium_mg"?: number | null,"carb_g": number,"confidence"?: string | null,"created_at"?: string,"fat_g": number,"fiber_g"?: number | null,"grams": number,"id"?: string,"iron_mg"?: number | null,"kcal": number,"magnesium_mg"?: number | null,"matched_name"?: string | null,"meal_id": string,"name": string,"nutrient_source": Database["public"]['Enums']["nutrient_source"],"per100g": NonNullable<Json>,"position": number,"potassium_mg"?: number | null,"preparation"?: string | null,"protein_g": number,"quantity_source": string,"satfat_g"?: number | null,"sodium_mg"?: number | null,"source_ref"?: string | null,"sugar_g"?: number | null,"updated_at"?: string,"user_id"?: string,"vitamin_d_ug"?: number | null
                  }
                  Update: {
                    "b12_ug"?: number | null,"calcium_mg"?: number | null,"carb_g"?: number,"confidence"?: string | null,"created_at"?: string,"fat_g"?: number,"fiber_g"?: number | null,"grams"?: number,"id"?: string,"iron_mg"?: number | null,"kcal"?: number,"magnesium_mg"?: number | null,"matched_name"?: string | null,"meal_id"?: string,"name"?: string,"nutrient_source"?: Database["public"]['Enums']["nutrient_source"],"per100g"?: NonNullable<Json>,"position"?: number,"potassium_mg"?: number | null,"preparation"?: string | null,"protein_g"?: number,"quantity_source"?: string,"satfat_g"?: number | null,"sodium_mg"?: number | null,"source_ref"?: string | null,"sugar_g"?: number | null,"updated_at"?: string,"user_id"?: string,"vitamin_d_ug"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_items_meal_id_fkey"
      columns: ["meal_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["id"]
    }
                  ]
                },"meals": {
                  Row: {
                    "created_at": string,"id": string,"is_favorite": boolean,"local_date": string,"meal_type": Database["public"]['Enums']["meal_type"],"name": string | null,"occurred_at": string,"photo_path": string | null,"source": Database["public"]['Enums']["meal_source"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_favorite"?: boolean,"local_date": string,"meal_type": Database["public"]['Enums']["meal_type"],"name"?: string | null,"occurred_at": string,"photo_path"?: string | null,"source": Database["public"]['Enums']["meal_source"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_favorite"?: boolean,"local_date"?: string,"meal_type"?: Database["public"]['Enums']["meal_type"],"name"?: string | null,"occurred_at"?: string,"photo_path"?: string | null,"source"?: Database["public"]['Enums']["meal_source"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"planned_meals": {
                  Row: {
                    "created_at": string,"id": string,"items": NonNullable<Json>,"local_date": string,"logged_meal_id": string | null,"name": string,"slot": Database["public"]['Enums']["meal_type"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"items": NonNullable<Json>,"local_date": string,"logged_meal_id"?: string | null,"name": string,"slot": Database["public"]['Enums']["meal_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"items"?: NonNullable<Json>,"local_date"?: string,"logged_meal_id"?: string | null,"name"?: string,"slot"?: Database["public"]['Enums']["meal_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_meals_logged_meal_id_fkey"
      columns: ["logged_meal_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["id"]
    }
                  ]
                },"planned_sessions": {
                  Row: {
                    "activity_id": string | null,"adjusted_details": Json | null,"auto_completed": boolean,"completed_at": string | null,"created_at": string,"day_index": number,"details": NonNullable<Json>,"id": string,"local_date": string,"manual": boolean,"plan_id": string,"position": number,"status": string,"type": string,"updated_at": string,"user_id": string,"workout_session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"adjusted_details"?: Json | null,"auto_completed"?: boolean,"completed_at"?: string | null,"created_at"?: string,"day_index": number,"details": NonNullable<Json>,"id"?: string,"local_date": string,"manual"?: boolean,"plan_id": string,"position"?: number,"status"?: string,"type": string,"updated_at"?: string,"user_id"?: string,"workout_session_id"?: string | null
                  }
                  Update: {
                    "activity_id"?: string | null,"adjusted_details"?: Json | null,"auto_completed"?: boolean,"completed_at"?: string | null,"created_at"?: string,"day_index"?: number,"details"?: NonNullable<Json>,"id"?: string,"local_date"?: string,"manual"?: boolean,"plan_id"?: string,"position"?: number,"status"?: string,"type"?: string,"updated_at"?: string,"user_id"?: string,"workout_session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_sessions_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_sessions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "training_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_sessions_workout_session_id_fkey"
      columns: ["workout_session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "allergies": (string)[],"birth_date": string,"created_at": string,"cuisines": (string)[],"diet_type": string,"dislikes": (string)[],"display_name": string,"height_cm": number,"lifestyle_level": string,"max_hr_bpm": number | null,"progress_photo_ai_consent_at": string | null,"running_experience": string,"sex": string,"strength_experience": string,"timezone": string,"unit_system": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allergies"?: (string)[],"birth_date": string,"created_at"?: string,"cuisines"?: (string)[],"diet_type"?: string,"dislikes"?: (string)[],"display_name": string,"height_cm": number,"lifestyle_level"?: string,"max_hr_bpm"?: number | null,"progress_photo_ai_consent_at"?: string | null,"running_experience": string,"sex": string,"strength_experience": string,"timezone"?: string,"unit_system"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "allergies"?: (string)[],"birth_date"?: string,"created_at"?: string,"cuisines"?: (string)[],"diet_type"?: string,"dislikes"?: (string)[],"display_name"?: string,"height_cm"?: number,"lifestyle_level"?: string,"max_hr_bpm"?: number | null,"progress_photo_ai_consent_at"?: string | null,"running_experience"?: string,"sex"?: string,"strength_experience"?: string,"timezone"?: string,"unit_system"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"progress_photo_analyses": {
                  Row: {
                    "created_at": string,"id": string,"local_date": string,"model": string,"observations": (string)[],"occurred_at": string,"photo_a_id": string,"photo_b_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"local_date": string,"model": string,"observations": (string)[],"occurred_at": string,"photo_a_id": string,"photo_b_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"local_date"?: string,"model"?: string,"observations"?: (string)[],"occurred_at"?: string,"photo_a_id"?: string,"photo_b_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "progress_photo_analyses_photo_a_id_fkey"
      columns: ["photo_a_id"]
isOneToOne: false
      referencedRelation: "progress_photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "progress_photo_analyses_photo_b_id_fkey"
      columns: ["photo_b_id"]
isOneToOne: false
      referencedRelation: "progress_photos"
      referencedColumns: ["id"]
    }
                  ]
                },"progress_photos": {
                  Row: {
                    "created_at": string,"height": number,"id": string,"local_date": string,"occurred_at": string,"pose": Database["public"]['Enums']["photo_pose"],"storage_path": string,"updated_at": string,"user_id": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height": number,"id"?: string,"local_date": string,"occurred_at": string,"pose": Database["public"]['Enums']["photo_pose"],"storage_path": string,"updated_at"?: string,"user_id"?: string,"width": number
                  }
                  Update: {
                    "created_at"?: string,"height"?: number,"id"?: string,"local_date"?: string,"occurred_at"?: string,"pose"?: Database["public"]['Enums']["photo_pose"],"storage_path"?: string,"updated_at"?: string,"user_id"?: string,"width"?: number
                  }
                  Relationships: [
                    
                  ]
                },"readiness_checkins": {
                  Row: {
                    "adjustment_choice": string,"created_at": string,"energy": number,"id": string,"local_date": string,"occurred_at": string,"pain_flag": boolean,"pain_note": string | null,"reasons": NonNullable<Json>,"score": string,"signals": NonNullable<Json>,"sleep_quality": number,"soreness": number,"stress": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_choice"?: string,"created_at"?: string,"energy": number,"id"?: string,"local_date": string,"occurred_at"?: string,"pain_flag"?: boolean,"pain_note"?: string | null,"reasons"?: NonNullable<Json>,"score": string,"signals"?: NonNullable<Json>,"sleep_quality": number,"soreness": number,"stress": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "adjustment_choice"?: string,"created_at"?: string,"energy"?: number,"id"?: string,"local_date"?: string,"occurred_at"?: string,"pain_flag"?: boolean,"pain_note"?: string | null,"reasons"?: NonNullable<Json>,"score"?: string,"signals"?: NonNullable<Json>,"sleep_quality"?: number,"soreness"?: number,"stress"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"signup_allowlist": {
                  Row: {
                    "pattern": string
                  }
                  ComputedFields: never
                  Insert: {
                    "pattern": string
                  }
                  Update: {
                    "pattern"?: string
                  }
                  Relationships: [
                    
                  ]
                },"training_plans": {
                  Row: {
                    "acknowledged_warnings": boolean,"context_snapshot": NonNullable<Json>,"created_at": string,"id": string,"local_date": string,"occurred_at": string,"phase": string,"status": string,"updated_at": string,"user_id": string,"warnings": NonNullable<Json>,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_warnings"?: boolean,"context_snapshot": NonNullable<Json>,"created_at"?: string,"id"?: string,"local_date": string,"occurred_at"?: string,"phase": string,"status"?: string,"updated_at"?: string,"user_id"?: string,"warnings"?: NonNullable<Json>,"week_start": string
                  }
                  Update: {
                    "acknowledged_warnings"?: boolean,"context_snapshot"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"local_date"?: string,"occurred_at"?: string,"phase"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string,"warnings"?: NonNullable<Json>,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"training_preferences": {
                  Row: {
                    "created_at": string,"days_per_week": number,"equipment": string,"id": string,"long_run_weekday": number,"max_session_min": number,"race_date": string | null,"race_distance_km": number | null,"race_goal_time": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"days_per_week": number,"equipment": string,"id"?: string,"long_run_weekday": number,"max_session_min": number,"race_date"?: string | null,"race_distance_km"?: number | null,"race_goal_time"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"days_per_week"?: number,"equipment"?: string,"id"?: string,"long_run_weekday"?: number,"max_session_min"?: number,"race_date"?: string | null,"race_distance_km"?: number | null,"race_goal_time"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_ai_keys": {
                  Row: {
                    "auth_tag": string,"ciphertext": string,"created_at": string,"invalid_at": string | null,"iv": string,"key_version": number,"last4": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_tag": string,"ciphertext": string,"created_at"?: string,"invalid_at"?: string | null,"iv": string,"key_version"?: number,"last4": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "auth_tag"?: string,"ciphertext"?: string,"created_at"?: string,"invalid_at"?: string | null,"iv"?: string,"key_version"?: number,"last4"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workout_sessions": {
                  Row: {
                    "created_at": string,"finished_at": string | null,"id": string,"local_date": string,"occurred_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"finished_at"?: string | null,"id"?: string,"local_date": string,"occurred_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"finished_at"?: string | null,"id"?: string,"local_date"?: string,"occurred_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workout_sets": {
                  Row: {
                    "created_at": string,"distance_m": number | null,"duration_s": number | null,"exercise_id": string,"id": string,"local_date": string,"occurred_at": string,"reps": number | null,"rpe": number | null,"session_id": string,"set_number": number,"set_type": Database["public"]['Enums']["set_type"],"source": Database["public"]['Enums']["set_source"],"transcript": string | null,"updated_at": string,"user_id": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"distance_m"?: number | null,"duration_s"?: number | null,"exercise_id": string,"id"?: string,"local_date"?: string,"occurred_at"?: string,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"set_number"?: number,"set_type"?: Database["public"]['Enums']["set_type"],"source"?: Database["public"]['Enums']["set_source"],"transcript"?: string | null,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"distance_m"?: number | null,"duration_s"?: number | null,"exercise_id"?: string,"id"?: string,"local_date"?: string,"occurred_at"?: string,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"set_number"?: number,"set_type"?: Database["public"]['Enums']["set_type"],"source"?: Database["public"]['Enums']["set_source"],"transcript"?: string | null,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sets_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sets_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "daily_body_weight": {
                  Row: {
                    "local_date": string | null,"source": string | null,"user_id": string | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_training_plan":
{ Args: { "p_plan_id": string }; Returns: undefined
                           },
"bump_ingest_rate":
{ Args: { "p_token_id": string }; Returns: number
                           },
"delete_set":
{ Args: { "p_set_id": string }; Returns: undefined
                           },
"finish_session":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"import_fit_activity":
{ Args: { "p_activity": Json,"p_splits": Json }; Returns: Json
                           },
"ingest_health":
{ Args: { "p_payload": Json,"p_user_id": string }; Returns: Json
                           },
"int_array":
{ Args: { "p": Json }; Returns: (number)[]
                           },
"match_activity":
{ Args: { "p_external_id": string,"p_sport": string,"p_start": string,"p_user_id": string }; Returns: string
                           },
"match_exercises":
{ Args: { "p_equipment"?: string,"p_limit"?: number,"p_muscle"?: Database["public"]['Enums']["muscle_group"],"p_query"?: string }; Returns: {
              "equipment": string,"id": string,"is_custom": boolean,"name": string,"primary_groups": (Database["public"]['Enums']["muscle_group"])[],"score": number,"tracking_mode": Database["public"]['Enums']["tracking_mode"]
            }[]
                           },
"replace_body_goal":
{ Args: { "p_goal_body_fat_pct": number,"p_goal_weight_kg": number,"p_local_date": string,"p_occurred_at": string,"p_target_date": string }; Returns: string
                           },
"rotate_ingest_token":
{ Args: { "p_last4": string,"p_prefix": string,"p_token_hash": string,"p_user_id": string }; Returns: string
                           },
"seed_exercises":
{ Args: { "p_exercises": Json }; Returns: number
                           },
"text_items_within":
{ Args: { "items": (string)[],"max_len": number }; Returns: boolean
                           },
"user_owned_tables":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"weekly_muscle_volume":
{ Args: { "p_week_start": string }; Returns: {
              "muscle_group": Database["public"]['Enums']["muscle_group"],"sets": number
            }[]
                           }
          }
          Enums: {
            "body_comp_method": "inbody"|"tanita"|"dexa"|"withings"|"other_bia"|"skinfold"|"other","goal_status": "active"|"archived","meal_source": "photo"|"text"|"search"|"relog"|"planned","meal_type": "breakfast"|"lunch"|"dinner"|"snack","muscle_group": "chest"|"back"|"shoulders"|"biceps"|"triceps"|"forearms"|"core"|"glutes"|"quads"|"hamstrings"|"calves"|"full_body"|"cardio","muscle_role": "primary"|"secondary","nutrient_source": "usda"|"off"|"estimated","photo_pose": "front"|"side"|"back","set_source": "manual"|"voice"|"text","set_type": "warmup"|"working"|"drop"|"failure","tracking_mode": "weight_reps"|"bodyweight_reps"|"duration"|"distance_duration"
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
            "body_comp_method": ["inbody", "tanita", "dexa", "withings", "other_bia", "skinfold", "other"],"goal_status": ["active", "archived"],"meal_source": ["photo", "text", "search", "relog", "planned"],"meal_type": ["breakfast", "lunch", "dinner", "snack"],"muscle_group": ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "core", "glutes", "quads", "hamstrings", "calves", "full_body", "cardio"],"muscle_role": ["primary", "secondary"],"nutrient_source": ["usda", "off", "estimated"],"photo_pose": ["front", "side", "back"],"set_source": ["manual", "voice", "text"],"set_type": ["warmup", "working", "drop", "failure"],"tracking_mode": ["weight_reps", "bodyweight_reps", "duration", "distance_duration"]
          }
        }
} as const
