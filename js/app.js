import { handleCredentialResponse, signOut, checkLoginStatus } from './auth/auth.js';
import { loadNewBetForm, handleWebsiteSelect, saveBet } from './components/newBet.js';
import { loadBetHistory, confirmDeleteBet, deleteBetById, editBet, applyFilters, sortBets } from './components/betHistory.js';
import { loadDashboard, loadUserData, applyDashboardFilters } from './components/dashboard.js';
import { loadSuperBoostStrategy } from './components/strategy.js';
import { handleNavigation } from './views/router.js';
import { showNotification } from './utils/utils.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM Content Loaded - initializing application");

    // Expose functions to window for direct access from HTML - do this FIRST
    // before any other initialization to ensure the callback is available
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
    
    console.log("Exposed app functions to window");
    
    // Set the Google Client ID from config (as backup)
    const googleSignIn = document.getElementById('g_id_onload');
    if (googleSignIn) {
        console.log("Found Google Sign-In element, configuring...");
        // Only set if not already present
        if (!googleSignIn.getAttribute('data-client_id') || googleSignIn.getAttribute('data-client_id') === '') {
            googleSignIn.setAttribute('data-client_id', config.googleClientId);
            console.log("Set client ID from config:", config.googleClientId);
        } else {
            console.log("Client ID already set in HTML:", googleSignIn.getAttribute('data-client_id'));
        }
        googleSignIn.setAttribute('data-itp_support', true);
        googleSignIn.setAttribute('data-use_fedcm_for_prompt', true);
        console.log("Google Sign-In configured successfully");
    } else {
        console.error("Google Sign-In element not found!");
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
    
    // Explicitly initialize Google Sign-In after our app is ready
    // Wait for Google API to be loaded
    window.googleAPILoaded = function() {
        console.log("Google API loaded, initializing Sign-In...");
        try {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
                google.accounts.id.initialize({
                    client_id: config.googleClientId,
                    callback: window.app.handleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: false
                });
                
                // Render the button explicitly
                const buttonContainer = document.querySelector('.g_id_signin');
                if (buttonContainer) {
                    google.accounts.id.renderButton(
                        buttonContainer,
                        { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with', shape: 'rectangular' }
                    );
                    console.log("Google Sign-In button rendered manually");
                } else {
                    console.error("Google Sign-In button container not found");
                }
                
                console.log("Google Sign-In initialized manually");
            } else {
                console.error("Google API is not loaded or missing required objects");
            }
        } catch (error) {
            console.error("Error initializing Google Sign-In:", error);
        }
    };
    
    console.log("Betting application initialized successfully!");
});

export default window.app;
