import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://kndvtiqulaqjyqcasttt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZHZ0aXF1bGFxanlxY2FzdHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NjM5NzMsImV4cCI6MjA5OTAzOTk3M30.BfOeT5AWNfy9WzqopQw_2mdmiRseKRX9wfsRyav2REU",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  }
);
