// Initialize the Supabase client
const supabaseUrl = config.supabaseUrl;
const supabaseAnonKey = config.supabaseAnonKey;

// Create a single supabase client for interacting with your database
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Function to fetch bets from Supabase
async function fetchBets(userId = null) {
    let query = supabaseClient.from('bets').select('*');
    
    // If userId is provided, filter by user
    if (userId) {
        query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('date', { ascending: false });
    
    if (error) {
        console.error('Error fetching bets:', error);
        return [];
    }
    
    return data || [];
}

// Function to add a new bet to Supabase
async function addBet(betData) {
    // Format the data to match the database schema
    const formattedData = {
        user_id: betData.user_id,
        website: betData.website,
        description: betData.description,
        odds: betData.odds,
        boosted_odds: betData['boosted-odds'] || null,
        amount: betData.amount,
        date: new Date(betData.date).toISOString(),
        outcome: betData.outcome
    };
    
    const { data, error } = await supabaseClient
        .from('bets')
        .insert([formattedData]);
    
    if (error) {
        console.error('Error adding bet:', error);
        return false;
    }
    
    return true;
}

// Function to update an existing bet in Supabase
async function updateBet(id, betData) {
    // Format the data to match the database schema
    const formattedData = {
        website: betData.website,
        description: betData.description,
        odds: betData.odds,
        boosted_odds: betData['boosted-odds'] || null,
        amount: betData.amount,
        date: new Date(betData.date).toISOString(),
        outcome: betData.outcome
    };
    
    const { data, error } = await supabaseClient
        .from('bets')
        .update(formattedData)
        .eq('id', id);
    
    if (error) {
        console.error('Error updating bet:', error);
        return false;
    }
    
    return true;
}

// Function to delete a bet from Supabase
async function deleteBet(id) {
    const { data, error } = await supabaseClient
        .from('bets')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting bet:', error);
        return false;
    }
    
    return true;
} 