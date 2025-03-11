import { handleCredentialResponse, signOut, checkLoginStatus } from './auth/auth.js';
import { loadNewBetForm, handleWebsiteSelect, saveBet } from './components/newBet.js';
import { loadBetHistory, confirmDeleteBet, deleteBetById, editBet, applyFilters, sortBets } from './components/betHistory.js';
import { loadDashboard, loadUserData, applyDashboardFilters } from './components/dashboard.js';
import { loadSuperBoostStrategy } from './components/strategy.js';
import { handleNavigation } from './views/router.js';
import { showNotification } from './utils/utils.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set the Google Client ID from config
    const googleSignIn = document.getElementById('g_id_onload');
    if (googleSignIn) {
        googleSignIn.setAttribute('data-client_id', config.googleClientId);
    }
    
    // Check if user was previously logged in (page refresh)
    checkLoginStatus();
    
    // Update navigation event listeners
    const navLinks = document.querySelectorAll('.sidebar nav ul li a');
    navLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            await handleNavigation(targetId);
        });
    });
    
    // Add logout button event listener
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', signOut);
    }
    
    // Expose functions to window for direct access from HTML
    window.app = {
        handleCredentialResponse,
        signOut,
        handleNavigation,
        loadNewBetForm,
        handleWebsiteSelect,
        saveBet,
        loadBetHistory,
        confirmDeleteBet,
        deleteBetById,
        editBet,
        applyFilters,
        sortBets,
        loadDashboard,
        loadUserData,
        applyDashboardFilters,
        loadSuperBoostStrategy,
        showNotification
    };
    
    console.log("Betting application initialized successfully!");
});

export default window.app;
