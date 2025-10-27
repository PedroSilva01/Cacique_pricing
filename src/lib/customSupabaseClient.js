import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lwzgyzjzgfsfoapzswws.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3emd5emp6Z2ZzZm9hcHpzd3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMjk1MDUsImV4cCI6MjA3NjkwNTUwNX0.F-HUZvOYXlXxktuWwVWzwtCOH8FgK8KWkk-2kjjP5CE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);