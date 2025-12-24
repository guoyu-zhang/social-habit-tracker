import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database table names
export const TABLES = {
  USERS: "users",
  HABITS: "habits",
  HABIT_COMPLETIONS: "habit_completions",
  HABIT_IMAGES: "habit_images",
} as const;

// Storage bucket names
export const BUCKETS = {
  HABIT_IMAGES: "habit-images",
  AVATARS: "avatars",
} as const;
