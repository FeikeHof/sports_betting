// Initialize the Supabase client
const { supabaseUrl } = config;
const { supabaseAnonKey } = config;

// Create a single supabase client for interacting with your database
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Export the Supabase client for use in other modules
export { supabaseClient };
