// User authentication state
let userProfile = null;

// Set the Google Client ID from config
document.addEventListener('DOMContentLoaded', function() {
    const googleSignIn = document.getElementById('g_id_onload');
    if (googleSignIn) {
        googleSignIn.setAttribute('data-client_id', config.googleClientId);
    }
    
    // Check if user was previously logged in (page refresh)
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
    }
    
    // Update navigation event listeners
    const navLinks = document.querySelectorAll('.sidebar nav ul li a');
    navLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            await handleNavigation(targetId);
        });
    });
});

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

// Function to load user-specific data
async function loadUserData() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userBets = await fetchBets(user.id);
        
        // Calculate active (pending) and completed bets
        const activeBets = userBets.filter(bet => bet.outcome === 'pending').length;
        const completedBets = userBets.filter(bet => bet.outcome !== 'pending').length;
        
        // Calculate total profit/loss
        const totalProfitLoss = userBets.reduce((total, bet) => {
            if (bet.outcome === 'pending') return total;
            
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const stake = parseFloat(bet.amount);
                const totalPayout = stake * odds;
                const profit = totalPayout - stake;
                return total + profit;
            } else if (bet.outcome === 'loss') {
                return total - parseFloat(bet.amount);
            }
            return total;
        }, 0);
        
        // Update the content section with real data
        const contentSection = document.getElementById('content');
        contentSection.innerHTML = `
            <h2>Welcome back, ${userProfile.name}!</h2>
            <p>Your betting dashboard is ready.</p>
            <div class="user-stats">
                <div class="stat-box">
                    <div class="stat-value">${activeBets}</div>
                    <div class="stat-label">Active Bets</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${completedBets}</div>
                    <div class="stat-label">Completed Bets</div>
                </div>
                <div class="stat-box ${totalProfitLoss >= 0 ? 'positive' : 'negative'}">
                    <div class="stat-value">€${totalProfitLoss.toFixed(2)}</div>
                    <div class="stat-label">Total Profit/Loss</div>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn-primary" onclick="handleNavigation('new-bet')">Place New Bet</button>
                <button class="btn-secondary" onclick="handleNavigation('dashboard')">View Dashboard</button>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading user data:', error);
        const contentSection = document.getElementById('content');
        contentSection.innerHTML = `
            <h2>Welcome back, ${userProfile.name}!</h2>
            <p>Error loading your betting statistics. Please try again later.</p>
            <button class="btn-primary" onclick="loadUserData()">Retry</button>
        `;
    }
}

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
        default:
            // Default welcome content
            if (userProfile) {
                loadUserData();
            } else {
                contentSection.innerHTML = `
                    <p>Select an option from the sidebar to get started.</p>
                `;
            }
    }
}

// Add this function to fetch unique websites from existing bets
async function getUniqueWebsites() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userBets = await fetchBets(user.id);
        const websites = [...new Set(userBets.map(bet => bet.website))].sort();
        return websites;
    } catch (error) {
        console.error('Error fetching websites:', error);
        return [];
    }
}

// Update the loadNewBetForm function
async function loadNewBetForm() {
    const contentSection = document.getElementById('content');
    
    // Get unique websites
    const websites = await getUniqueWebsites();
    
    contentSection.innerHTML = `
        <h2>Create New Bet</h2>
        <form id="new-bet-form" class="bet-form">
            <div class="form-group">
                <label for="website">Website:</label>
                <div class="website-input-group">
                    <select id="website-select" onchange="handleWebsiteSelect(this.value)">
                        <option value="">-- Select Website --</option>
                        ${websites.map(site => `
                            <option value="${site}">${site}</option>
                        `).join('')}
                        <option value="new">+ Add New Website</option>
                    </select>
                    <input type="text" id="website" name="website" required 
                           placeholder="e.g., DraftKings, FanDuel" 
                           style="display: none;">
                </div>
            </div>
            
            <div class="form-group">
                <label for="description">Description:</label>
                <textarea id="description" name="description" required placeholder="Describe your bet"></textarea>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="odds">Decimal Odds:</label>
                    <input type="number" id="odds" name="odds" step="0.01" min="1.01" required placeholder="1.91">
                    <small class="form-hint">Decimal odds (e.g., 1.91, 2.50, etc.)</small>
                </div>
                
                <div class="form-group">
                    <label for="boosted-odds">Boosted Odds (optional):</label>
                    <input type="number" id="boosted-odds" name="boosted-odds" step="0.01" min="1.01" placeholder="2.00">
                    <small class="form-hint">Boosted decimal odds if applicable</small>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="amount">Amount Bet (€):</label>
                    <input type="number" id="amount" name="amount" step="0.01" min="0.01" required placeholder="10.00">
                </div>
                
                <div class="form-group">
                    <label for="date">Date of Bet:</label>
                    <input type="date" id="date" name="date" required>
                </div>
            </div>
            
            <div class="form-group">
                <label for="outcome">Outcome:</label>
                <select id="outcome" name="outcome" required>
                    <option value="">-- Select Outcome --</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="pending">Pending</option>
                </select>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn-primary">Save Bet</button>
                <button type="reset" class="btn-secondary">Clear Form</button>
            </div>
        </form>
    `;
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // Add form submission handler
    document.getElementById('new-bet-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveBet();
    });
}

// Add this function to handle website selection
function handleWebsiteSelect(value) {
    const websiteInput = document.getElementById('website');
    const websiteSelect = document.getElementById('website-select');
    
    if (value === 'new') {
        // Show input field for new website
        websiteInput.style.display = 'block';
        websiteInput.value = '';
        websiteInput.focus();
    } else if (value === '') {
        // Empty selection
        websiteInput.style.display = 'none';
        websiteInput.value = '';
    } else {
        // Existing website selected
        websiteInput.style.display = 'none';
        websiteInput.value = value;
    }
}

// Function to save bet
async function saveBet() {
    try {
        // First, check if user is authenticated
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
            showNotification('Please sign in to save bets', 'error');
            return;
        }
        
        const form = document.getElementById('new-bet-form');
        const formData = new FormData(form);
        const betData = Object.fromEntries(formData.entries());
        
        // Check website field
        const websiteInput = document.getElementById('website');
        betData.website = websiteInput.value;
        
        // Validate form data
        if (!validateBetData(betData)) {
            return; // Stop if validation fails
        }
        
        // Check if we're in edit mode
        const editId = form.getAttribute('data-edit-id');
        
        // Add user ID to the bet data
        betData.user_id = user.id;  // Make sure to use user_id for Supabase
        
        let success = false;
        
        if (editId) {
            success = await updateBet(editId, betData);
        } else {
            success = await addBet(betData);
        }
        
        if (success) {
            showNotification('Bet saved successfully!', 'success');
            setTimeout(() => {
                handleNavigation('bet-history');
            }, 1500);
        } else {
            showNotification('Error saving bet. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error in saveBet:', error);
        showNotification('Error saving bet. Please try again.', 'error');
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
            outcome: betData.outcome
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

// Function to validate bet data
function validateBetData(data) {
    // Check required fields
    if (!data.website || !data.description || !data.odds || !data.amount || !data.date || !data.outcome) {
        showNotification('Please fill in all required fields', 'error');
        return false;
    }
    
    // Validate odds (should be a decimal number >= 1.01)
    const odds = parseFloat(data.odds);
    if (isNaN(odds) || odds < 1.01) {
        showNotification('Odds must be a decimal number of 1.01 or higher', 'error');
        return false;
    }
    
    // Validate amount (should be a positive number)
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
        showNotification('Amount must be a positive number', 'error');
        return false;
    }
    
    // Validate boosted odds if provided
    if (data['boosted-odds']) {
        const boostedOdds = parseFloat(data['boosted-odds']);
        if (isNaN(boostedOdds) || boostedOdds < 1.01) {
            showNotification('Boosted odds must be a decimal number of 1.01 or higher', 'error');
            return false;
        }
    }
    
    // Validate date (should not be in the future)
    const betDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (betDate > today) {
        showNotification('Date cannot be in the future', 'error');
        return false;
    }
    
    return true;
}

// Function to show notification
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set message and type
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Function to load bet history
async function loadBetHistory() {
    const contentSection = document.getElementById('content');
    
    try {
        // Show loading indicator
        contentSection.innerHTML = `
            <h2>Bet History</h2>
            <p>Loading your bets...</p>
        `;
        
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userId = user ? user.id : null;
        
        // Fetch bets from Supabase
        const userBets = await fetchBets(userId);
        
        if (userBets.length === 0) {
            contentSection.innerHTML = `
                <h2>Bet History</h2>
                <p>You haven't placed any bets yet.</p>
                <button class="btn-primary" onclick="handleNavigation('new-bet')">Place Your First Bet</button>
            `;
            return;
        }
        
        // Continue with existing code to display bets...
        // Note: You'll need to adjust property names to match Supabase column names
        // e.g., bet.user_id instead of bet.userId
        
        // Create view toggle buttons
        const viewToggle = `
            <div class="view-toggle">
                <button class="toggle-btn active" data-view="table">Table View</button>
                <button class="toggle-btn" data-view="cards">Card View</button>
            </div>
        `;
        
        // Create filter buttons
        const filterButtons = `
            <div class="bet-filters">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="win">Wins</button>
                <button class="filter-btn" data-filter="loss">Losses</button>
                <button class="filter-btn" data-filter="pending">Pending</button>
            </div>
        `;
        
        // Create search input
        const searchInput = `
            <div class="search-container">
                <input type="text" id="bet-search" placeholder="Search bets...">
                <button id="search-button">Search</button>
            </div>
        `;
        
        // Create date filter
        const dateFilter = `
            <div class="date-filter">
                <label for="date-from">From:</label>
                <input type="date" id="date-from">
                <label for="date-to">To:</label>
                <input type="date" id="date-to">
                <button id="date-filter-button">Filter</button>
                <button id="date-filter-reset">Reset</button>
            </div>
        `;
        
        // Generate table rows for bets
        const tableRows = userBets.map(bet => {
            // Calculate profit/loss
            let profitLoss = 0;
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const stake = parseFloat(bet.amount);
                const totalPayout = stake * odds;
                profitLoss = totalPayout - stake;  // Subtract stake to get actual profit
            } else if (bet.outcome === 'loss') {
                profitLoss = -parseFloat(bet.amount);
            }
            
            // Format profit/loss for display
            const formattedProfitLoss = bet.outcome === 'pending' 
                ? 'Pending' 
                : (profitLoss >= 0 ? '+€' : '-€') + Math.abs(profitLoss).toFixed(2);
            
            // Format date
            const betDate = new Date(bet.date);
            const formattedDate = betDate.toLocaleDateString();
            
            // Determine row class based on outcome
            const rowClass = bet.outcome === 'win' ? 'win-row' : 
                            bet.outcome === 'loss' ? 'loss-row' : 
                            'pending-row';
            
            return `
                <tr class="${rowClass}" data-bet-id="${bet.id}">
                    <td>${formattedDate}</td>
                    <td>${bet.website}</td>
                    <td class="description-cell">${bet.description}</td>
                    <td>${parseFloat(bet.odds).toFixed(2)}</td>
                    <td>${bet.boosted_odds ? parseFloat(bet.boosted_odds).toFixed(2) : '-'}</td>
                    <td>€${parseFloat(bet.amount).toFixed(2)}</td>
                    <td class="outcome-cell ${bet.outcome}">${bet.outcome.toUpperCase()}</td>
                    <td class="profit-loss ${profitLoss >= 0 ? 'positive' : 'negative'}">
                        ${formattedProfitLoss}
                    </td>
                    <td class="actions-cell">
                        <button class="btn-edit" onclick="editBet(${bet.id})">Edit</button>
                        <button class="btn-delete" onclick="confirmDeleteBet(${bet.id})">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Generate cards for bets
        const betCards = userBets.map(bet => {
            // Calculate profit/loss
            let profitLoss = 0;
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const stake = parseFloat(bet.amount);
                const totalPayout = stake * odds;
                profitLoss = totalPayout - stake;  // Subtract stake to get actual profit
            } else if (bet.outcome === 'loss') {
                profitLoss = -parseFloat(bet.amount);
            }
            
            // Format profit/loss for display
            const formattedProfitLoss = bet.outcome === 'pending' 
                ? 'Pending' 
                : (profitLoss >= 0 ? '+€' : '-€') + Math.abs(profitLoss).toFixed(2);
            
            // Format date
            const betDate = new Date(bet.date);
            const formattedDate = betDate.toLocaleDateString();
            
            return `
                <div class="bet-card ${bet.outcome}" data-bet-id="${bet.id}">
                    <div class="bet-card-header">
                        <span class="bet-date">${formattedDate}</span>
                        <span class="bet-website">${bet.website}</span>
                    </div>
                    <div class="bet-card-body">
                        <p class="bet-description">${bet.description}</p>
                        <div class="bet-details">
                            <div class="bet-detail">
                                <span class="detail-label">Odds:</span>
                                <span class="detail-value">${parseFloat(bet.odds).toFixed(2)}</span>
                            </div>
                            ${bet.boosted_odds ? `
                            <div class="bet-detail">
                                <span class="detail-label">Boosted:</span>
                                <span class="detail-value">${parseFloat(bet.boosted_odds).toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="bet-detail">
                                <span class="detail-label">Amount:</span>
                                <span class="detail-value">€${parseFloat(bet.amount).toFixed(2)}</span>
                            </div>
                            <div class="bet-detail">
                                <span class="detail-label">Outcome:</span>
                                <span class="detail-value outcome-${bet.outcome}">${bet.outcome.toUpperCase()}</span>
                            </div>
                            <div class="bet-detail">
                                <span class="detail-label">Profit/Loss:</span>
                                <span class="detail-value ${profitLoss >= 0 ? 'positive' : 'negative'}">
                                    ${formattedProfitLoss}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="bet-card-footer">
                        <button class="btn-edit" onclick="editBet(${bet.id})">Edit</button>
                        <button class="btn-delete" onclick="confirmDeleteBet(${bet.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Calculate total bet amount and profit/loss
        const totalBetAmount = userBets.reduce((total, bet) => total + parseFloat(bet.amount), 0);
        const totalProfitLoss = userBets.reduce((total, bet) => {
            if (bet.outcome === 'pending') return total;
            
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const amount = parseFloat(bet.amount);
                return total + (amount * odds);
            } else if (bet.outcome === 'loss') {
                return total - parseFloat(bet.amount);
            }
            
            return total;
        }, 0);
        
        // Create the HTML for the bet history page
        contentSection.innerHTML = `
            <h2>Bet History</h2>
            
            <div class="history-controls">
                <div class="controls-row">
                    ${viewToggle}
                    ${filterButtons}
                </div>
                <div class="controls-row">
                    ${searchInput}
                    ${dateFilter}
                </div>
            </div>
            
            <div class="table-container" id="table-view">
                <table class="bet-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="date">Date <span class="sort-icon">↓</span></th>
                            <th class="sortable" data-sort="website">Website</th>
                            <th class="sortable" data-sort="description">Description</th>
                            <th class="sortable" data-sort="odds">Odds</th>
                            <th>Boosted Odds</th>
                            <th class="sortable" data-sort="amount">Amount (€)</th>
                            <th class="sortable" data-sort="outcome">Outcome</th>
                            <th class="sortable" data-sort="profit-loss">Profit/Loss (€)</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="bet-table-body">
                        ${tableRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="summary-label">Summary:</td>
                            <td>€${totalBetAmount.toFixed(2)}</td>
                            <td></td>
                            <td class="profit-loss ${totalProfitLoss >= 0 ? 'positive' : 'negative'}">
                                ${totalProfitLoss >= 0 ? '+€' : '-€'}${Math.abs(totalProfitLoss).toFixed(2)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="card-container" id="card-view" style="display: none;">
                ${betCards}
            </div>
        `;
        
        // Add event listeners for view toggle
        document.querySelectorAll('.toggle-btn').forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                document.querySelectorAll('.toggle-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Show/hide views based on button clicked
                const view = this.getAttribute('data-view');
                if (view === 'table') {
                    document.getElementById('table-view').style.display = 'block';
                    document.getElementById('card-view').style.display = 'none';
                } else {
                    document.getElementById('table-view').style.display = 'none';
                    document.getElementById('card-view').style.display = 'grid';
                }
            });
        });
        
        // Add event listeners for filter buttons
        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Add active class to clicked button
                this.classList.add('active');
                
                // Apply filter
                applyFilters();
            });
        });
        
        // Add event listener for search
        document.getElementById('search-button').addEventListener('click', function() {
            applyFilters();
        });
        
        // Add event listener for date filter
        document.getElementById('date-filter-button').addEventListener('click', function() {
            applyFilters();
        });
        
        // Add event listener for date filter reset
        document.getElementById('date-filter-reset').addEventListener('click', function() {
            document.getElementById('date-from').value = '';
            document.getElementById('date-to').value = '';
            applyFilters();
        });
        
        // Add event listeners for sortable columns
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', function() {
                const sortBy = this.getAttribute('data-sort');
                const currentDirection = this.querySelector('.sort-icon').textContent;
                const newDirection = currentDirection === '↓' ? '↑' : '↓';
                
                // Reset all sort icons
                document.querySelectorAll('.sort-icon').forEach(icon => {
                    icon.textContent = '';
                });
                
                // Set the new sort icon
                this.querySelector('.sort-icon').textContent = newDirection;
                
                // Sort the bets
                sortBets(sortBy, newDirection === '↓' ? 'desc' : 'asc');
            });
        });
        
    } catch (error) {
        console.error('Error loading bet history:', error);
        contentSection.innerHTML = `
            <h2>Bet History</h2>
            <p>Error loading bets. Please try again later.</p>
            <button class="btn-primary" onclick="loadBetHistory()">Retry</button>
        `;
    }
}

// Function to apply filters to the bet history
function applyFilters() {
    const outcomeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
    const searchTerm = document.getElementById('bet-search').value.toLowerCase();
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    
    // Get all rows/cards
    const tableRows = document.querySelectorAll('#bet-table-body tr');
    const cards = document.querySelectorAll('.bet-card');
    
    // Filter the rows/cards
    tableRows.forEach(row => {
        const betId = row.getAttribute('data-bet-id');
        const outcome = row.querySelector('.outcome-cell').classList[1];
        const website = row.cells[1].textContent.toLowerCase();
        const description = row.cells[2].textContent.toLowerCase();
        const dateText = row.cells[0].textContent;
        const date = new Date(dateText);
        
        let visible = true;
        
        // Apply outcome filter
        if (outcomeFilter !== 'all' && outcome !== outcomeFilter) {
            visible = false;
        }
        
        // Apply search filter
        if (searchTerm && !website.includes(searchTerm) && !description.includes(searchTerm)) {
            visible = false;
        }
        
        // Apply date filter
        if (dateFrom && date < new Date(dateFrom)) {
            visible = false;
        }
        
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // End of the day
            if (date > toDate) {
                visible = false;
            }
        }
        
        row.style.display = visible ? '' : 'none';
    });
    
    cards.forEach(card => {
        const betId = card.getAttribute('data-bet-id');
        const outcome = card.classList[1];
        const website = card.querySelector('.bet-website').textContent.toLowerCase();
        const description = card.querySelector('.bet-description').textContent.toLowerCase();
        const dateText = card.querySelector('.bet-date').textContent;
        const date = new Date(dateText);
        
        let visible = true;
        
        // Apply outcome filter
        if (outcomeFilter !== 'all' && outcome !== outcomeFilter) {
            visible = false;
        }
        
        // Apply search filter
        if (searchTerm && !website.includes(searchTerm) && !description.includes(searchTerm)) {
            visible = false;
        }
        
        // Apply date filter
        if (dateFrom && date < new Date(dateFrom)) {
            visible = false;
        }
        
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999); // End of the day
            if (date > toDate) {
                visible = false;
            }
        }
        
        card.style.display = visible ? '' : 'none';
    });
    
    // Update summary row
    updateSummaryRow();
}

// Function to update the summary row based on visible bets
function updateSummaryRow() {
    const visibleRows = Array.from(document.querySelectorAll('#bet-table-body tr:not(.filtered)'));
    let totalAmount = 0;
    let totalProfitLoss = 0;

    visibleRows.forEach(row => {
        // Get the amount and outcome from the row
        const amount = parseFloat(row.cells[5].textContent.replace('€', ''));
        const outcome = row.cells[6].textContent.toLowerCase();
        const odds = parseFloat(row.cells[3].textContent);
        const boostedOdds = row.cells[4].textContent !== '-' ? parseFloat(row.cells[4].textContent) : null;
        
        totalAmount += amount;
        
        // Calculate profit/loss using the same logic as elsewhere
        if (outcome !== 'pending') {
            if (outcome === 'win') {
                const effectiveOdds = boostedOdds || odds;
                const stake = amount;
                const totalPayout = stake * effectiveOdds;
                const profit = totalPayout - stake;  // Subtract stake to get actual profit
                totalProfitLoss += profit;
            } else if (outcome === 'loss') {
                totalProfitLoss -= amount;
            }
        }
    });

    // Make sure we're selecting the correct summary row
    const tableBody = document.getElementById('bet-table-body');
    const summaryRow = tableBody.parentElement.querySelector('tfoot tr');
    if (summaryRow) {
        summaryRow.innerHTML = `
            <td colspan="5" class="summary-label">Summary (${visibleRows.length} bets):</td>
            <td>€${totalAmount.toFixed(2)}</td>
            <td></td>
            <td class="profit-loss ${totalProfitLoss >= 0 ? 'positive' : 'negative'}">
                ${totalProfitLoss >= 0 ? '+€' : '-€'}${Math.abs(totalProfitLoss).toFixed(2)}
            </td>
            <td></td>
        `;
    }
}

// Function to sort bets
function sortBets(sortBy, direction) {
    const tableBody = document.getElementById('bet-table-body');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortBy) {
            case 'date':
                valueA = new Date(a.cells[0].textContent);
                valueB = new Date(b.cells[0].textContent);
                break;
            case 'website':
                valueA = a.cells[1].textContent.toLowerCase();
                valueB = b.cells[1].textContent.toLowerCase();
                break;
            case 'description':
                valueA = a.cells[2].textContent.toLowerCase();
                valueB = b.cells[2].textContent.toLowerCase();
                break;
            case 'odds':
                valueA = parseFloat(a.cells[3].textContent);
                valueB = parseFloat(b.cells[3].textContent);
                break;
            case 'amount':
                valueA = parseFloat(a.cells[5].textContent.replace('€', ''));
                valueB = parseFloat(b.cells[5].textContent.replace('€', ''));
                break;
            case 'outcome':
                valueA = a.cells[6].textContent;
                valueB = b.cells[6].textContent;
                break;
            case 'profit-loss':
                const textA = a.cells[7].textContent;
                const textB = b.cells[7].textContent;
                
                if (textA === 'Pending' && textB === 'Pending') {
                    valueA = valueB = 0;
                } else if (textA === 'Pending') {
                    valueA = -Infinity;
                    valueB = parseFloat(textB.replace(/[+€-]/g, '')) * 
                            (textB.includes('-') ? -1 : 1);
                } else if (textB === 'Pending') {
                    valueA = parseFloat(textA.replace(/[+€-]/g, '')) * 
                            (textA.includes('-') ? -1 : 1);
                    valueB = -Infinity;
                } else {
                    valueA = parseFloat(textA.replace(/[+€-]/g, '')) * 
                            (textA.includes('-') ? -1 : 1);
                    valueB = parseFloat(textB.replace(/[+€-]/g, '')) * 
                            (textB.includes('-') ? -1 : 1);
                }
                break;
            default:
                valueA = valueB = 0;
        }
        
        if (direction === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
    
    // Reorder the rows
    rows.forEach(row => tableBody.appendChild(row));
    
    // Also sort the cards if needed
    sortCards(sortBy, direction);
}

// Function to sort cards
function sortCards(sortBy, direction) {
    const cardContainer = document.getElementById('card-view');
    const cards = Array.from(cardContainer.querySelectorAll('.bet-card'));
    
    cards.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortBy) {
            case 'date':
                valueA = new Date(a.querySelector('.bet-date').textContent);
                valueB = new Date(b.querySelector('.bet-date').textContent);
                break;
            case 'website':
                valueA = a.querySelector('.bet-website').textContent.toLowerCase();
                valueB = b.querySelector('.bet-website').textContent.toLowerCase();
                break;
            case 'description':
                valueA = a.querySelector('.bet-description').textContent.toLowerCase();
                valueB = b.querySelector('.bet-description').textContent.toLowerCase();
                break;
            // Add other cases as needed
            default:
                valueA = valueB = 0;
        }
        
        if (direction === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
    
    // Reorder the cards
    cards.forEach(card => cardContainer.appendChild(card));
}

// Function to load dashboard
async function loadDashboard() {
    const contentSection = document.getElementById('content');
    
    try {
        // Show loading indicator
        contentSection.innerHTML = `
            <h2>Dashboard</h2>
            <p>Loading your betting statistics...</p>
        `;
        
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userId = user ? user.id : null;
        
        // Fetch bets from Supabase
        const userBets = await fetchBets(userId);
        
        if (userBets.length === 0) {
            contentSection.innerHTML = `
                <h2>Dashboard</h2>
                <p>You haven't placed any bets yet. Start tracking your bets to see statistics here.</p>
                <button class="btn-primary" onclick="handleNavigation('new-bet')">Place Your First Bet</button>
            `;
            return;
        }
        
        // Calculate key statistics
        const totalBets = userBets.length;
        const totalAmount = userBets.reduce((total, bet) => total + parseFloat(bet.amount), 0);
        const wins = userBets.filter(bet => bet.outcome === 'win').length;
        const winRate = ((wins / totalBets) * 100).toFixed(1);
        
        // Calculate total profit/loss
        const totalProfitLoss = userBets.reduce((total, bet) => {
            if (bet.outcome === 'pending') return total;
            
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const stake = parseFloat(bet.amount);
                const totalPayout = stake * odds;
                const profit = totalPayout - stake;  // Subtract stake to get actual profit
                return total + profit;
            } else if (bet.outcome === 'loss') {
                return total - parseFloat(bet.amount);
            }
            return total;
        }, 0);
        
        // Calculate ROI
        const roi = ((totalProfitLoss / totalAmount) * 100).toFixed(1);
        
        // Group bets by website
        const websiteStats = {};
        userBets.forEach(bet => {
            if (!websiteStats[bet.website]) {
                websiteStats[bet.website] = {
                    totalBets: 0,
                    totalAmount: 0,
                    wins: 0,
                    losses: 0,
                    pending: 0,
                    profitLoss: 0
                };
            }
            
            const stats = websiteStats[bet.website];
            stats.totalBets++;
            stats.totalAmount += parseFloat(bet.amount);
            
            if (bet.outcome === 'win') {
                stats.wins++;
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const stake = parseFloat(bet.amount);
                const totalPayout = stake * odds;
                const profit = totalPayout - stake;  // Subtract stake to get actual profit
                stats.profitLoss += profit;
            } else if (bet.outcome === 'loss') {
                stats.losses++;
                stats.profitLoss -= parseFloat(bet.amount);
            } else {
                stats.pending++;
            }
        });
        
        // Prepare data for cumulative profit chart
        const chartData = prepareCumulativeProfitData(userBets);
        
        // Generate HTML for the dashboard
        contentSection.innerHTML = `
            <h2>Betting Dashboard</h2>
            
            <div class="dashboard-container">
                <!-- Summary Statistics -->
                <section class="dashboard-section">
                    <h3>Summary Statistics</h3>
                    <div class="stats-container">
                        <div class="stat-box">
                            <div class="stat-value">${totalBets}</div>
                            <div class="stat-label">Total Bets</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">€${totalAmount.toFixed(2)}</div>
                            <div class="stat-label">Total Amount Bet</div>
                        </div>
                        <div class="stat-box ${totalProfitLoss >= 0 ? 'positive' : 'negative'}">
                            <div class="stat-value">€${totalProfitLoss.toFixed(2)}</div>
                            <div class="stat-label">Total Profit/Loss</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${winRate}%</div>
                            <div class="stat-label">Win Rate</div>
                        </div>
                        <div class="stat-box ${roi >= 0 ? 'positive' : 'negative'}">
                            <div class="stat-value">${roi}%</div>
                            <div class="stat-label">Return on Investment</div>
                        </div>
                    </div>
                </section>
                
                <!-- Cumulative Profit Chart -->
                <section class="dashboard-section">
                    <h3>Cumulative Profit Over Time</h3>
                    ${chartData.labels.length > 0 ? 
                        `<div class="chart-container">
                            <canvas id="profitChart"></canvas>
                        </div>` : 
                        `<div class="no-data-message">
                            <p>Not enough completed bets to display profit chart.</p>
                        </div>`
                    }
                </section>
                
                <!-- Website Performance -->
                <section class="dashboard-section">
                    <h3>Website Performance</h3>
                    <div class="website-stats">
                        ${Object.entries(websiteStats).map(([website, stats]) => `
                            <div class="website-stat-card">
                                <h4>${website}</h4>
                                <div class="stat-grid">
                                    <div class="stat-item">
                                        <span class="label">Total Bets:</span>
                                        <span class="value">${stats.totalBets}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Total Amount:</span>
                                        <span class="value">€${stats.totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Win Rate:</span>
                                        <span class="value">${((stats.wins / stats.totalBets) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Profit/Loss:</span>
                                        <span class="value ${stats.profitLoss >= 0 ? 'positive' : 'negative'}">
                                            €${stats.profitLoss.toFixed(2)}
                                        </span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="label">Record:</span>
                                        <span class="value">${stats.wins}W-${stats.losses}L-${stats.pending}P</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </section>
                
                <!-- Recent Bets -->
                <section class="dashboard-section">
                    <h3>Recent Bets</h3>
                    <div class="recent-bets-container">
                        ${userBets.slice(0, 5).map(bet => {
                            const profitLoss = bet.outcome === 'win' 
                                ? (parseFloat(bet.amount) * (bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds)) - parseFloat(bet.amount))  // Subtract stake
                                : (bet.outcome === 'loss' ? -parseFloat(bet.amount) : 0);
                            
                            return `
                                <div class="recent-bet ${bet.outcome}">
                                    <div class="recent-bet-header">
                                        <span class="recent-bet-date">${new Date(bet.date).toLocaleDateString()}</span>
                                        <span class="recent-bet-website">${bet.website}</span>
                                    </div>
                                    <p class="recent-bet-desc">${bet.description}</p>
                                    <div class="recent-bet-footer">
                                        <span class="recent-bet-amount">€${parseFloat(bet.amount).toFixed(2)}</span>
                                        <span class="recent-bet-outcome ${bet.outcome}">${bet.outcome.toUpperCase()}</span>
                                        ${bet.outcome !== 'pending' 
                                            ? `<span class="recent-bet-profit ${profitLoss >= 0 ? 'positive' : 'negative'}">
                                                ${profitLoss >= 0 ? '+' : ''}€${profitLoss.toFixed(2)}
                                               </span>`
                                            : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="view-all-container">
                        <button class="btn-secondary" onclick="handleNavigation('bet-history')">View All Bets</button>
                    </div>
                </section>
            </div>
        `;
        
        // Initialize the chart if we have data
        if (chartData.labels.length > 0) {
            initializeProfitChart(chartData);
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        contentSection.innerHTML = `
            <h2>Dashboard</h2>
            <p>Error loading betting statistics. Please try again later.</p>
            <button class="btn-primary" onclick="loadDashboard()">Retry</button>
        `;
    }
}

// Function to prepare data for cumulative profit chart
function prepareCumulativeProfitData(bets) {
    // Filter out pending bets and sort by date
    const completedBets = bets
        .filter(bet => bet.outcome !== 'pending')
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (completedBets.length < 2) {
        return { labels: [], data: [] };
    }
    
    // Group bets by date
    const betsByDate = {};
    
    completedBets.forEach(bet => {
        const date = new Date(bet.date).toLocaleDateString();
        
        if (!betsByDate[date]) {
            betsByDate[date] = [];
        }
        
        betsByDate[date].push(bet);
    });
    
    // Calculate profit/loss for each date
    const labels = [];
    const data = [];
    let cumulativeProfit = 0;
    
    // Process dates in chronological order
    Object.keys(betsByDate)
        .sort((a, b) => new Date(a) - new Date(b))
        .forEach(date => {
            let dailyProfit = 0;
            
            // Calculate profit for all bets on this date
            betsByDate[date].forEach(bet => {
                if (bet.outcome === 'win') {
                    const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                    const stake = parseFloat(bet.amount);
                    const totalPayout = stake * odds;
                    dailyProfit += totalPayout - stake;  // Subtract stake to get actual profit
                } else if (bet.outcome === 'loss') {
                    dailyProfit -= parseFloat(bet.amount);
                }
            });
            
            // Add to cumulative profit
            cumulativeProfit += dailyProfit;
            
            labels.push(date);
            data.push(cumulativeProfit.toFixed(2));
        });
    
    return { labels, data };
}

// Function to initialize the profit chart
function initializeProfitChart(chartData) {
    const ctx = document.getElementById('profitChart').getContext('2d');
    
    // Determine if the overall trend is positive or negative
    const lastValue = parseFloat(chartData.data[chartData.data.length - 1]);
    const chartColor = lastValue >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(231, 76, 60, 1)';
    const chartBgColor = lastValue >= 0 ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';
    
    // Create gradient for the line
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, lastValue >= 0 ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Cumulative Profit (€)',
                data: chartData.data,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: chartColor,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                fill: true,
                tension: 0.2,
                cubicInterpolationMode: 'monotone'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 6,
                    callbacks: {
                        title: function(context) {
                            return `Date: ${context[0].label}`;
                        },
                        label: function(context) {
                            const value = parseFloat(context.raw);
                            const sign = value >= 0 ? '+' : '';
                            return `Cumulative Profit: ${sign}€${value.toFixed(2)}`;
                        },
                        labelTextColor: function(context) {
                            const value = parseFloat(context.raw);
                            return value >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(231, 76, 60, 1)';
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14
                        },
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: {top: 10, bottom: 0}
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    title: {
                        display: true,
                        text: 'Cumulative Profit (€)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: {top: 0, bottom: 10}
                    },
                    ticks: {
                        callback: function(value) {
                            const sign = value >= 0 ? '+' : '';
                            return `${sign}€${value}`;
                        },
                        font: {
                            size: 12
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                line: {
                    borderJoinStyle: 'round'
                }
            }
        }
    });
}

// Function to confirm delete bet
function confirmDeleteBet(id) {
    if (confirm('Are you sure you want to delete this bet?')) {
        deleteBetById(id);
    }
}

async function deleteBetById(id) {
    try {
        const success = await deleteBet(id);
        
        if (success) {
            showNotification('Bet deleted successfully!', 'success');
            
            // Reload the current page
            const currentPage = window.location.hash.substring(1) || 'dashboard';
            handleNavigation(currentPage);
        } else {
            showNotification('Error deleting bet. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error deleting bet:', error);
        showNotification('Error deleting bet. Please try again.', 'error');
    }
}

// Update the editBet function
async function editBet(id) {
    try {
        // Get current user and bets
        const { data: { user } } = await supabaseClient.auth.getUser();
        const userBets = await fetchBets(user.id);
        
        // Find the bet to edit
        const bet = userBets.find(bet => bet.id === id);
        
        if (!bet) {
            showNotification('Bet not found.', 'error');
            return;
        }
        
        // Load the new bet form
        await loadNewBetForm();
        
        // Set the website in both select and input
        const websiteSelect = document.getElementById('website-select');
        const websiteInput = document.getElementById('website');
        
        // If the website exists in the dropdown, select it
        if ([...websiteSelect.options].some(option => option.value === bet.website)) {
            websiteSelect.value = bet.website;
            websiteInput.style.display = 'none';
        } else {
            // If it doesn't exist, show as new website
            websiteSelect.value = 'new';
            websiteInput.style.display = 'block';
        }
        websiteInput.value = bet.website;
        
        // Fill the rest of the form
        document.getElementById('description').value = bet.description;
        document.getElementById('odds').value = bet.odds;
        if (bet.boosted_odds) {
            document.getElementById('boosted-odds').value = bet.boosted_odds;
        }
        document.getElementById('amount').value = bet.amount;
        document.getElementById('date').value = new Date(bet.date).toISOString().split('T')[0];
        document.getElementById('outcome').value = bet.outcome;
        
        // Set the form to edit mode
        const form = document.getElementById('new-bet-form');
        form.setAttribute('data-edit-id', id);
        
        // Update the form title and button
        document.querySelector('h2').textContent = 'Edit Bet';
        document.querySelector('.btn-primary').textContent = 'Update Bet';
        
        // Add a cancel button
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'btn-secondary';
        cancelButton.textContent = 'Cancel';
        cancelButton.onclick = () => handleNavigation('bet-history');
        
        document.querySelector('.form-actions').appendChild(cancelButton);
    } catch (error) {
        console.error('Error editing bet:', error);
        showNotification('Error loading bet for editing. Please try again.', 'error');
    }
} 