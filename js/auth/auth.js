import { supabaseClient } from '../api/supabase.js';
import { loadUserData } from '../components/dashboard.js';

// User authentication state
let userProfile = null;

// Function to handle Google Sign-In response
async function handleCredentialResponse(response) {
    try {
        // Sign in to Supabase with Google token
        const { data, error } = await supabaseClient.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
        });
        
        if (error) {
            console.error('Supabase auth error:', error);
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
        
        // Update UI to show logged in state
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('user-info').style.display = 'block';
        
        // Set user information in the profile section
        document.getElementById('user-name').textContent = userProfile.name;
        document.getElementById('user-email').textContent = userProfile.email;
        document.getElementById('user-picture').src = userProfile.picture;
        
        // Store authentication in session storage
        sessionStorage.setItem('userProfile', JSON.stringify(userProfile));
        
        console.log("User signed in:", userProfile);
        
        // Load user data
        loadUserData();
        
    } catch (error) {
        console.error('Error during sign in:', error);
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
            return;
        }
        
        // Clear user data
        userProfile = null;
        sessionStorage.removeItem('userProfile');
        
        // Update UI to show logged out state
        document.getElementById('login-container').style.display = 'block';
        document.getElementById('user-info').style.display = 'none';
        
        // Clear user-specific data from the page
        document.getElementById('user-name').textContent = '';
        document.getElementById('user-email').textContent = '';
        document.getElementById('user-picture').src = '';
        
        console.log("User signed out");
        
        // Revoke Google authentication
        google.accounts.id.disableAutoSelect();
        
    } catch (error) {
        console.error('Error during sign out:', error);
    }
}

// Function to check if user is already logged in
function checkLoginStatus() {
    const savedProfile = sessionStorage.getItem('userProfile');
    if (savedProfile) {
        userProfile = JSON.parse(savedProfile);
        
        // Update UI to show logged in state
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('user-info').style.display = 'block';
        
        // Set user information in the profile section
        document.getElementById('user-name').textContent = userProfile.name;
        document.getElementById('user-email').textContent = userProfile.email;
        document.getElementById('user-picture').src = userProfile.picture;
        
        // Load user data
        loadUserData();
        
        return true;
    }
    return false;
}

// Get current user profile
function getCurrentUser() {
    return userProfile;
}

export { 
    handleCredentialResponse, 
    signOut, 
    checkLoginStatus, 
    getCurrentUser,
    userProfile 
};
