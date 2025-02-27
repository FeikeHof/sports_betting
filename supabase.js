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

/**
 * Inserts a new bet into the Supabase 'bets' table
 * 
 * @param {string} website - The betting website name
 * @param {string} description - Description of the bet
 * @param {number} odds - Decimal odds of the bet
 * @param {number|null} boostedOdds - Boosted odds if available, null otherwise
 * @param {number} amount - Amount bet in euros
 * @param {string|Date} date - Date of the bet (ISO string or Date object)
 * @param {string} outcome - Outcome of the bet ('win', 'loss', or 'pending')
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function insertNewBet(website, description, odds, boostedOdds, amount, date, outcome) {
    try {
        // Get the current user ID
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.error('No authenticated user found');
            return false;
        }
        
        // Create the bet object
        const betData = {
            user_id: user.id,  // Make sure this matches the user_id in your RLS policy
            website,
            description,
            odds: parseFloat(odds),
            boosted_odds: boostedOdds ? parseFloat(boostedOdds) : null,
            amount: parseFloat(amount),
            date: date instanceof Date ? date.toISOString() : new Date(date).toISOString(),
            outcome
        };
        
        // Insert the bet into Supabase
        const { data, error } = await supabaseClient
            .from('bets')
            .insert([betData]);
        
        if (error) {
            console.error('Error inserting bet:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error inserting bet:', error);
        return false;
    }
} 