import { supabaseClient } from '../api/supabase.js';
import { loadNewBetForm } from '../components/newBet.js';
import { loadBetHistory } from '../components/betHistory.js';
import { loadDashboard, loadUserData } from '../components/dashboard.js';
import { loadSuperBoostStrategy } from '../components/strategy.js';

// Function to handle navigation
async function handleNavigation(targetId) {
    const contentSection = document.getElementById('content');
    
    // Check authentication for protected routes
    if (['new-bet', 'bet-history', 'dashboard'].includes(targetId)) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            contentSection.innerHTML = `
                <h2>Authentication Required</h2>
                <p>Please sign in to access this feature.</p>
            `;
            return;
        }
    }
    
    // Clear any existing content
    contentSection.innerHTML = '';
    
    // Handle navigation based on targetId
    switch(targetId) {
        case 'new-bet':
            loadNewBetForm();
            break;
        case 'bet-history':
            loadBetHistory();
            break;
        case 'dashboard':
            loadDashboard();
            break;
        case 'strategy':
            loadSuperBoostStrategy();
            break;
        default:
            // Default welcome content
            if (sessionStorage.getItem('userProfile')) {
                loadUserData();
            } else {
                contentSection.innerHTML = `
                    <p>Select an option from the sidebar to get started.</p>
                `;
            }
    }
}

// Export the handleNavigation function
export { handleNavigation };
