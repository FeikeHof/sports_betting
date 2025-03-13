import { supabaseClient } from '../api/supabase.js';
import { loadUserData } from '../components/dashboard.js';
import { showNotification } from '../utils/utils.js';

// User authentication state
let userProfile = null;

// Function to handle Google Sign-In response
async function handleCredentialResponse(response) {
    try {
        // Show a notification that we're processing the sign-in
        showNotification("Signing in...", "info");
        
        // Sign in to Supabase with Google token
        const { data, error } = await supabaseClient.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
        });
        
        if (error) {
            console.error('Supabase auth error:', error);
            showNotification("Authentication failed: " + error.message, "error");
            return;
        }
        
        // Decode the JWT token to get user information
        const responsePayload = parseJwt(response.credential);
        
        // Store user profile information
        userProfile = {
            id: data.user.id, // Use Supabase user ID instead of Google sub
            name: responsePayload.name,
            email: responsePayload.email,
            picture: responsePayload.picture
        };
        
        // Update UI using our helper function
        updateUIforLoggedInUser(userProfile);
        
        // Store authentication in session storage
        sessionStorage.setItem('userProfile', JSON.stringify(userProfile));
        
        showNotification("Successfully signed in as " + userProfile.name, "success");
        
        // Load user data
        loadUserData();
        
    } catch (error) {
        console.error('Error during sign in:', error);
        showNotification("Error during sign in: " + error.message, "error");
    }
}

// Helper function to parse JWT token
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    return JSON.parse(jsonPayload);
}

// Function to sign out
async function signOut() {
    try {
        // Sign out from Supabase
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error('Error signing out from Supabase:', error);
            showNotification("Error signing out: " + error.message, "error");
            return;
        }
        
        // Clear user data
        userProfile = null;
        sessionStorage.removeItem('userProfile');
        
        // Update UI to show logged out state
        const loginContainer = document.getElementById('login-container');
        const userInfoContainer = document.getElementById('user-info');
        const userNameEl = document.getElementById('user-name');
        const userEmailEl = document.getElementById('user-email');
        const userPictureEl = document.getElementById('user-picture');
        
        if (loginContainer) loginContainer.style.display = 'block';
        if (userInfoContainer) userInfoContainer.style.display = 'none';
        
        // Clear user-specific data from the page
        if (userNameEl) userNameEl.textContent = '';
        if (userEmailEl) userEmailEl.textContent = '';
        if (userPictureEl) userPictureEl.src = '';
        
        showNotification("Successfully signed out", "success");
        
        // Revoke Google authentication if Google API is available
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        
        // Force reload of the page to ensure clean state
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.error('Error during sign out:', error);
        showNotification("Error during sign out: " + error.message, "error");
    }
}

// Function to check if user is already logged in
async function checkLoginStatus() {
    try {
        // First check if there's an active Supabase session
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error("Error checking session:", error);
            return false;
        }
        
        if (!session) {
            // Clear any outdated storage data
            sessionStorage.removeItem('userProfile');
            return false;
        }
        
        // We have a valid session, now check if we have the profile info
        let savedProfile = sessionStorage.getItem('userProfile');
        
        if (!savedProfile) {
            // We have a session but no saved profile, try to get user data from Supabase
            const { data: { user } } = await supabaseClient.auth.getUser();
            
            if (user) {
                // Create minimal profile from Supabase user data
                savedProfile = JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.email,
                    picture: user.user_metadata?.avatar_url || 'assets/images/default-avatar.png'
                });
                
                // Save this for future use
                sessionStorage.setItem('userProfile', savedProfile);
            } else {
                return false;
            }
        }
        
        // Parse and use the profile data
        userProfile = JSON.parse(savedProfile);
        
        // Update UI to show logged in state
        updateUIforLoggedInUser(userProfile);
        
        // Hide the Google Sign-In button if present
        hideGoogleSignIn();
        
        // Load user data
        loadUserData();
        
        return true;
    } catch (error) {
        console.error("Error checking login status:", error);
        // Clear any saved profile in case of errors
        sessionStorage.removeItem('userProfile');
        return false;
    }
}

// Helper function to update UI for logged in user
function updateUIforLoggedInUser(profile) {
    const loginContainer = document.getElementById('login-container');
    const userInfoContainer = document.getElementById('user-info');
    
    if (loginContainer) {
        loginContainer.style.display = 'none';
    } else {
        console.error("Login container element not found in checkLoginStatus!");
    }
    
    if (userInfoContainer) {
        userInfoContainer.style.display = 'block';
    } else {
        console.error("User info container element not found in checkLoginStatus!");
    }
    
    // Set user information in the profile section
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userPictureEl = document.getElementById('user-picture');
    
    if (userNameEl) {
        userNameEl.textContent = profile.name;
    } else {
        console.error("User name element not found!");
    }
    
    if (userEmailEl) {
        userEmailEl.textContent = profile.email;
    } else {
        console.error("User email element not found!");
    }
    
    if (userPictureEl) {
        userPictureEl.src = profile.picture;
    } else {
        console.error("User picture element not found!");
    }
}

// Helper function to hide Google Sign-In elements
function hideGoogleSignIn() {
    // Hide any Google Sign-In elements that might be visible
    const gSignInElements = document.querySelectorAll('.g_id_signin');
    if (gSignInElements.length > 0) {
        gSignInElements.forEach(element => {
            element.style.display = 'none';
        });
    }
    
    // Try to disable Google Sign-In prompt as well
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        google.accounts.id.cancel();
    }
}

// Function to get current user profile
function getCurrentUser() {
    return userProfile;
}

// Export functions
export { 
    handleCredentialResponse, 
    signOut, 
    checkLoginStatus, 
    getCurrentUser,
    userProfile
};
