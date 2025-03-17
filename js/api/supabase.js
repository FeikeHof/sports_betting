// Import the supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.24.0/+esm';

// Initialize the Supabase client using global config
const { supabaseUrl } = window.config;
const { supabaseAnonKey } = window.config;

// Create a single supabase client for interacting with your database
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Export the Supabase client for use in other modules
export default supabaseClient;
