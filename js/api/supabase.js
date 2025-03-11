// Initialize the Supabase client
const supabaseUrl = config.supabaseUrl;
const supabaseAnonKey = config.supabaseAnonKey;

// Create a single supabase client for interacting with your database
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Export the Supabase client for use in other modules
export { supabaseClient };
