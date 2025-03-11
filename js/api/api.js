import { supabaseClient } from './supabase.js';

// Function to fetch bets from Supabase
async function fetchBets(userId) {
    try {
        let query = supabaseClient
            .from('bets')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching bets:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Unexpected error fetching bets:', error);
        return [];
    }
}

// Function to update bet in Supabase
async function updateBetInSupabase(id, betData) {
    try {
        // Format the data to match the database schema
        const formattedData = {
            website: betData.website,
            description: betData.description,
            odds: parseFloat(betData.odds),
            boosted_odds: betData['boosted-odds'] ? parseFloat(betData['boosted-odds']) : null,
            amount: parseFloat(betData.amount),
            date: new Date(betData.date).toISOString(),
            outcome: betData.outcome,
            note: betData.note || null  // Add note field
        };
        
        const { error } = await supabaseClient
            .from('bets')
            .update(formattedData)
            .eq('id', parseInt(id));
        
        if (error) {
            console.error('Error updating bet:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error updating bet:', error);
        return false;
    }
}

// Function to delete a bet from Supabase
async function deleteBet(id) {
    try {
        const { error } = await supabaseClient
            .from('bets')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting bet:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Unexpected error deleting bet:', error);
        return false;
    }
}

export { fetchBets, updateBetInSupabase, deleteBet };
