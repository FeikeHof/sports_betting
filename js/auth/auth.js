import { supabaseClient } from '../api/supabase.js';
import { loadUserData } from '../components/dashboard.js';
import { showNotification } from '../utils/utils.js';

// User authentication state
let userProfile = null;

// Function to handle Google Sign-In response
async function handleCredentialResponse(response) {
    console.log("Google Sign-In callback triggered", response);
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
        
        console.log("Supabase auth successful", data);
        
        // Decode the JWT token to get user information
        const responsePayload = parseJwt(response.credential);
        console.log("JWT decoded:", responsePayload);
        
        // Store user profile information
        userProfile = {
            id: data.user.id, // Use Supabase user ID instead of Google sub
            name: responsePayload.name,
            email: responsePayload.email,
            picture: responsePayload.picture
        };
        
        console.log("About to update UI...");
        
        // Update UI to show logged in state with a small delay to ensure DOM is ready
        setTimeout(() => {
            try {
                const loginContainer = document.getElementById('login-container');
                const userInfoContainer = document.getElementById('user-info');
                
                if (loginContainer) {
                    loginContainer.style.display = 'none';
                    console.log("Login container hidden");
                } else {
                    console.error("Login container element not found!");
                }
                
                if (userInfoContainer) {
                    userInfoContainer.style.display = 'block';
                    console.log("User info container shown");
                } else {
                    console.error("User info container element not found!");
                }
                
                // Set user information in the profile section
                const userNameEl = document.getElementById('user-name');
                const userEmailEl = document.getElementById('user-email');
                const userPictureEl = document.getElementById('user-picture');
                
                if (userNameEl) userNameEl.textContent = userProfile.name;
                if (userEmailEl) userEmailEl.textContent = userProfile.email;
                if (userPictureEl) userPictureEl.src = userProfile.picture;
                
                console.log("UI updated successfully");
            } catch (error) {
                console.error("Error updating UI:", error);
            }
        }, 100);
        
        // Store authentication in session storage
        sessionStorage.setItem('userProfile', JSON.stringify(userProfile));
        
        console.log("User signed in:", userProfile);
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
    console.log("Sign out initiated");
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
        
        console.log("User signed out");
        showNotification("Successfully signed out", "success");
        
        // Revoke Google authentication if Google API is available
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
            console.log("Google auto-select disabled");
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
function checkLoginStatus() {
    console.log("Checking login status...");
    const savedProfile = sessionStorage.getItem('userProfile');
    if (savedProfile) {
        try {
            console.log("Found saved profile:", savedProfile);
            userProfile = JSON.parse(savedProfile);
            
            // Update UI to show logged in state
            const loginContainer = document.getElementById('login-container');
            const userInfoContainer = document.getElementById('user-info');
            
            if (loginContainer) {
                loginContainer.style.display = 'none';
                console.log("Login container hidden by checkLoginStatus");
            } else {
                console.error("Login container element not found in checkLoginStatus!");
            }
            
            if (userInfoContainer) {
                userInfoContainer.style.display = 'block';
                console.log("User info container shown by checkLoginStatus");
            } else {
                console.error("User info container element not found in checkLoginStatus!");
            }
            
            // Set user information in the profile section
            const userNameEl = document.getElementById('user-name');
            const userEmailEl = document.getElementById('user-email');
            const userPictureEl = document.getElementById('user-picture');
            
            if (userNameEl) {
                userNameEl.textContent = userProfile.name;
                console.log("Set user name:", userProfile.name);
            } else {
                console.error("User name element not found!");
            }
            
            if (userEmailEl) {
                userEmailEl.textContent = userProfile.email;
                console.log("Set user email:", userProfile.email);
            } else {
                console.error("User email element not found!");
            }
            
            if (userPictureEl) {
                userPictureEl.src = userProfile.picture;
                console.log("Set user picture:", userProfile.picture);
            } else {
                console.error("User picture element not found!");
            }
            
            // Load user data
            console.log("About to load user data...");
            loadUserData();
            
            return true;
        } catch (error) {
            console.error("Error in checkLoginStatus:", error);
            // Invalid saved profile, clear it
            sessionStorage.removeItem('userProfile');
        }
    }
    console.log("No saved profile or error occurred, user is not logged in");
    return false;
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
