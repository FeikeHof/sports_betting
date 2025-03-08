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
        case 'strategy':
            loadSuperBoostStrategy();
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
            
            <div class="form-group">
                <label for="note">Note (optional):</label>
                <textarea id="note" name="note" placeholder="Add any additional notes about this bet"></textarea>
                <small class="form-hint">Add any relevant information, thoughts, or strategy notes</small>
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
        betData.user_id = user.id;
        
        let success = false;
        
        if (editId) {
            success = await updateBetInSupabase(editId, betData);
        } else {
            // Format the data to match the database schema
            const formattedData = {
                user_id: user.id,
                website: betData.website,
                description: betData.description,
                odds: parseFloat(betData.odds),
                boosted_odds: betData['boosted-odds'] ? parseFloat(betData['boosted-odds']) : null,
                amount: parseFloat(betData.amount),
                date: new Date(betData.date).toISOString(),
                outcome: betData.outcome,
                note: betData.note || null  // Add note field
            };
            
            // Insert the bet into Supabase
            const { error } = await supabaseClient
                .from('bets')
                .insert(formattedData);
            
            success = !error;
            
            if (error) {
                console.error('Error saving bet:', error);
            }
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
        
        // Fetch bets
        const userBets = await fetchBets(userId);
        
        if (userBets.length === 0) {
            contentSection.innerHTML = `
                <h2>Bet History</h2>
                <p>You haven't placed any bets yet.</p>
                <button class="btn-primary" onclick="handleNavigation('new-bet')">Place Your First Bet</button>
            `;
            return;
        }
        
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
        
        // Create the HTML for the bet history page
        contentSection.innerHTML = `
            <h2>Bet History</h2>
            
            <div class="history-controls">
                <div class="controls-row">
                    ${filterButtons}
            </div>
                <div class="controls-row">
                    ${searchInput}
                </div>
            </div>
            
            <div class="table-container">
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
                            <th class="sortable" data-sort="note">Note</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="bet-table-body">
                        ${userBets.map(bet => {
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
                                ? 'PENDING' 
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
                                    <td class="profit-loss ${bet.outcome === 'pending' ? 'pending' : (profitLoss >= 0 ? 'positive' : 'negative')}">
                        ${formattedProfitLoss}
                    </td>
                                    <td class="note-cell">${bet.note || '-'}</td>
                    <td class="actions-cell">
                                        <button class="btn-edit" onclick="editBet(${bet.id})" title="Edit bet">Edit</button>
                                        <button class="btn-delete" onclick="confirmDeleteBet(${bet.id})" title="Delete bet">Delete</button>
                    </td>
                </tr>
            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="summary-label">Summary (${userBets.length} bets):</td>
                            <td>€${userBets.reduce((total, bet) => total + parseFloat(bet.amount), 0).toFixed(2)}</td>
                            <td></td>
                            <td class="profit-loss ${userBets.reduce((total, bet) => {
                                if (bet.outcome === 'pending') return total;
                                
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const stake = parseFloat(bet.amount);
                const totalPayout = stake * odds;
                                    return total + (totalPayout - stake);
            } else if (bet.outcome === 'loss') {
                                    return total - parseFloat(bet.amount);
                                }
                                return total;
                            }, 0) >= 0 ? 'positive' : 'negative'}">
                                ${userBets.reduce((total, bet) => {
            if (bet.outcome === 'pending') return total;
            
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                                        const stake = parseFloat(bet.amount);
                                        const totalPayout = stake * odds;
                                        return total + (totalPayout - stake);
            } else if (bet.outcome === 'loss') {
                return total - parseFloat(bet.amount);
            }
            return total;
                                }, 0) >= 0 ? '+€' : '-€'}${Math.abs(userBets.reduce((total, bet) => {
                                    if (bet.outcome === 'pending') return total;
                                    
                                    if (bet.outcome === 'win') {
                                        const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                                        const stake = parseFloat(bet.amount);
                                        const totalPayout = stake * odds;
                                        return total + (totalPayout - stake);
                                    } else if (bet.outcome === 'loss') {
                                        return total - parseFloat(bet.amount);
                                    }
                                    return total;
                                }, 0)).toFixed(2)}
                            </td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        
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
    
    // Get all rows
    const tableRows = document.querySelectorAll('#bet-table-body tr');
    
    let visibleBets = [];
    
    // Filter the rows
    tableRows.forEach(row => {
        const outcome = row.querySelector('.outcome-cell').classList[1];
        const website = row.cells[1].textContent.toLowerCase();
        const description = row.cells[2].textContent.toLowerCase();
        const note = row.cells[8].textContent.toLowerCase();
        
        let visible = true;
        
        // Apply outcome filter
        if (outcomeFilter !== 'all' && outcome !== outcomeFilter) {
            visible = false;
        }
        
        // Apply search filter
        if (searchTerm && !website.includes(searchTerm) && !description.includes(searchTerm) && !note.includes(searchTerm)) {
            visible = false;
        }
        
        row.style.display = visible ? '' : 'none';
        
        // If visible, add to our collection of visible bets
        if (visible) {
            visibleBets.push({
                amount: parseFloat(row.cells[5].textContent.replace('€', '')),
                outcome: outcome,
                odds: parseFloat(row.cells[3].textContent),
                boostedOdds: row.cells[4].textContent !== '-' ? parseFloat(row.cells[4].textContent) : null
            });
        }
    });
    
    // Calculate new summary based on visible bets
    const totalBetAmount = visibleBets.reduce((total, bet) => total + bet.amount, 0);
    const totalProfitLoss = visibleBets.reduce((total, bet) => {
        if (bet.outcome === 'pending') return total;
        
        if (bet.outcome === 'win') {
            const odds = bet.boostedOdds || bet.odds;
            const stake = bet.amount;
            const totalPayout = stake * odds;
        return total + (totalPayout - stake);
        } else if (bet.outcome === 'loss') {
            return total - bet.amount;
        }
        return total;
    }, 0);
    
    // Update the summary row
    const summaryRow = document.querySelector('.bet-table tfoot tr');
    if (summaryRow) {
        summaryRow.innerHTML = `
            <td colspan="5" class="summary-label">Summary (${visibleBets.length} bets):</td>
            <td>€${totalBetAmount.toFixed(2)}</td>
            <td></td>
            <td class="profit-loss ${totalProfitLoss >= 0 ? 'positive' : 'negative'}">
                ${totalProfitLoss >= 0 ? '+€' : '-€'}${Math.abs(totalProfitLoss).toFixed(2)}
            </td>
            <td colspan="2"></td>
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
                
                if (textA === 'PENDING' && textB === 'PENDING') {
                    valueA = valueB = 0;
                } else if (textA === 'PENDING') {
                    valueA = -Infinity;
                    valueB = parseFloat(textB.replace(/[+€-]/g, '')) * 
                            (textB.includes('-') ? -1 : 1);
                } else if (textB === 'PENDING') {
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
        
        // Create filter buttons and search
        const filterButtons = `
            <div class="bet-filters">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="win">Wins</button>
                <button class="filter-btn" data-filter="loss">Losses</button>
                <button class="filter-btn" data-filter="pending">Pending</button>
            </div>
        `;
        
        const searchInput = `
            <div class="search-container">
                <input type="text" id="bet-search" placeholder="Search bets...">
                <button id="search-button">Search</button>
            </div>
        `;

        // Store bets in a global variable for filtering
        window.dashboardBets = userBets;
        
        // Generate HTML for the dashboard
        contentSection.innerHTML = `
            <h2>Betting Dashboard</h2>
            
            <div class="history-controls">
                <div class="controls-row">
                    ${filterButtons}
                </div>
                <div class="controls-row">
                    ${searchInput}
                </div>
            </div>

            <div class="dashboard-container" id="dashboard-content">
                <!-- Content will be updated by applyDashboardFilters -->
            </div>
        `;

        // Add event listeners for filters
        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
                applyDashboardFilters();
            });
        });

        // Add event listener for search
        document.getElementById('search-button').addEventListener('click', function() {
            applyDashboardFilters();
        });

        // Initial load with all bets
        applyDashboardFilters();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        contentSection.innerHTML = `
            <h2>Dashboard</h2>
            <p>Error loading betting statistics. Please try again later.</p>
            <button class="btn-primary" onclick="loadDashboard()">Retry</button>
        `;
    }
}

// Function to apply dashboard filters
function applyDashboardFilters() {
    const outcomeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
    const searchTerm = document.getElementById('bet-search').value.toLowerCase();
    
    // Filter bets
    const filteredBets = window.dashboardBets.filter(bet => {
        // Apply outcome filter
        if (outcomeFilter !== 'all' && bet.outcome !== outcomeFilter) {
            return false;
        }
        
        // Apply search filter
        if (searchTerm && !bet.website.toLowerCase().includes(searchTerm) && 
            !bet.description.toLowerCase().includes(searchTerm) &&
            !(bet.note && bet.note.toLowerCase().includes(searchTerm))) {
            return false;
        }
        
        return true;
    });

    // Calculate statistics based on filtered bets
    const totalBets = filteredBets.length;
    const totalAmount = filteredBets.reduce((total, bet) => total + parseFloat(bet.amount), 0);
    const wins = filteredBets.filter(bet => bet.outcome === 'win').length;
    const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : '0.0';
    
    const totalProfitLoss = filteredBets.reduce((total, bet) => {
            if (bet.outcome === 'pending') return total;
            
            if (bet.outcome === 'win') {
                const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
                const stake = parseFloat(bet.amount);
                const totalPayout = stake * odds;
            return total + (totalPayout - stake);
            } else if (bet.outcome === 'loss') {
                return total - parseFloat(bet.amount);
            }
            return total;
        }, 0);
        
    const roi = totalAmount > 0 ? ((totalProfitLoss / totalAmount) * 100).toFixed(1) : '0.0';
        
        // Group bets by website
        const websiteStats = {};
    filteredBets.forEach(bet => {
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
            stats.profitLoss += totalPayout - stake;
            } else if (bet.outcome === 'loss') {
                stats.losses++;
                stats.profitLoss -= parseFloat(bet.amount);
            } else {
                stats.pending++;
            }
        });
        
    // Prepare chart data
    const chartData = prepareCumulativeProfitData(filteredBets);
    const monthlyPerformanceData = calculateMonthlyPerformance(filteredBets);

    // Update dashboard content
    const dashboardContent = document.getElementById('dashboard-content');
    dashboardContent.innerHTML = `
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
        
        <!-- Monthly Performance -->
        <section class="dashboard-section">
            <h3>Monthly Performance</h3>
            ${monthlyPerformanceData.length > 0 ? 
                `<div class="chart-container">
                    <canvas id="monthlyPerformanceChart"></canvas>
                </div>` : 
                `<div class="no-data-message">
                    <p>Not enough data to display monthly performance.</p>
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
                                <span class="value">${stats.totalBets > 0 ? ((stats.wins / stats.totalBets) * 100).toFixed(1) : '0.0'}%</span>
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
                ${filteredBets.slice(0, 5).map(bet => {
                            const profitLoss = bet.outcome === 'win' 
                        ? (parseFloat(bet.amount) * (bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds)) - parseFloat(bet.amount))
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
    `;

    // Initialize charts if we have data
    if (chartData.labels.length > 0) {
        initializeProfitChart(chartData);
    }
    
    if (monthlyPerformanceData.length > 0) {
        initializeMonthlyPerformanceChart(monthlyPerformanceData);
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

// Function to calculate monthly performance
function calculateMonthlyPerformance(bets) {
    // Skip if no bets
    if (bets.length === 0) {
        return [];
    }
    
    // Filter out pending bets
    const completedBets = bets.filter(bet => bet.outcome !== 'pending');
    
    // Group bets by month
    const monthlyData = {};
    
    completedBets.forEach(bet => {
        const date = new Date(bet.date);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        
        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = {
                totalBets: 0,
                wins: 0,
                losses: 0,
                amountBet: 0,
                profit: 0
            };
        }
        
        const data = monthlyData[monthYear];
        data.totalBets++;
        data.amountBet += parseFloat(bet.amount);
        
        if (bet.outcome === 'win') {
            data.wins++;
            const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
            const stake = parseFloat(bet.amount);
            const totalPayout = stake * odds;
            data.profit += totalPayout - stake;  // Subtract stake to get actual profit
        } else if (bet.outcome === 'loss') {
            data.losses++;
            data.profit -= parseFloat(bet.amount);
        }
    });
    
    // Convert to array and sort by date (most recent first)
    return Object.entries(monthlyData)
        .map(([month, data]) => ({
            month,
            ...data,
            winRate: data.totalBets > 0 ? ((data.wins / data.totalBets) * 100).toFixed(1) : 0,
            roi: data.amountBet > 0 ? ((data.profit / data.amountBet) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => {
            // Extract month and year
            const [aMonth, aYear] = a.month.split(' ');
            const [bMonth, bYear] = b.month.split(' ');
            
            // Compare years first
            if (aYear !== bYear) {
                return bYear - aYear; // Most recent year first
            }
            
            // If years are the same, compare months
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months.indexOf(bMonth) - months.indexOf(aMonth); // Most recent month first
        });
}

// Function to initialize monthly performance chart
function initializeMonthlyPerformanceChart(monthlyData) {
    const ctx = document.getElementById('monthlyPerformanceChart').getContext('2d');
    
    // Prepare data for chart
    const months = monthlyData.map(data => data.month).reverse();
    const profits = monthlyData.map(data => data.profit.toFixed(2)).reverse();
    
    // Determine colors based on profit values
    const barColors = profits.map(profit => 
        parseFloat(profit) >= 0 ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)'
    );
    
    const barBorderColors = profits.map(profit => 
        parseFloat(profit) >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(231, 76, 60, 1)'
    );
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Monthly Profit/Loss (€)',
                data: profits,
                backgroundColor: barColors,
                borderColor: barBorderColors,
                borderWidth: 2,
                borderRadius: 4,
                barPercentage: 0.6,
                categoryPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const value = parseFloat(context.raw);
                            const sign = value >= 0 ? '+' : '';
                            const monthData = monthlyData[monthlyData.length - 1 - context.dataIndex];
                            
                            return [
                                `Profit/Loss: ${sign}€${value.toFixed(2)}`,
                                `Bets: ${monthData.totalBets} (${monthData.wins}W-${monthData.losses}L)`,
                                `Win Rate: ${monthData.winRate}%`,
                                `ROI: ${monthData.roi}%`
                            ];
                        }
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
                        text: 'Month',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    title: {
                        display: true,
                        text: 'Profit/Loss (€)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            const sign = value >= 0 ? '+' : '';
                            return `${sign}€${value}`;
                        }
                    }
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
        if (bet.note) {
            document.getElementById('note').value = bet.note;
        }
        
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

// Function to load super boost strategy page
function loadSuperBoostStrategy() {
    const contentSection = document.getElementById('content');
    
    contentSection.innerHTML = `
        <article class="strategy-content">
            <h2>Maximizing Profit with Super Boosts</h2>

            <section class="strategy-section">
                <h3>Introduction</h3>
                <p>Welcome to our in-depth analysis of super boosts, a promotional feature offered by many sportsbooks. We believe that super boosts create consistent opportunities for profitable betting. This page will explain why sportsbooks offer super boosts and how you can capitalize on them.</p>
                <img src="assets/images/super-boost-example.png" alt="Example of a Super Boost offer" class="strategy-image">
            </section>

            <section class="strategy-section">
                <h3>Why Do Sportsbooks Offer Super Boosts?</h3>
                <p>Sportsbooks introduce super boosts to attract traffic and engage users. These promotions temporarily enhance the odds of certain bets, often offering odds higher than their true probability suggests. While sportsbooks may take a short-term loss on these boosts, their ultimate goal is to encourage users to place additional, less favorable bets while logged in.</p>
                <img src="assets/images/sportsbook-marketing.png" alt="Sportsbook marketing strategy illustration" class="strategy-image">
                <div class="strategy-highlight">
                    <p>Key Point: Super boosts are marketing tools that can be turned into profit opportunities when used strategically and in isolation.</p>
                </div>
            </section>

            <section class="strategy-section">
                <h3>Understanding Expected Value (EV) and Decimal Odds</h3>
                <p>Before diving into super boosts, it's essential to understand two key concepts: decimal odds and expected value (EV).</p>

                <h4>What Are Decimal Odds?</h4>
                <p>Decimal odds represent the total return per 1 unit wagered, including the stake. For example:</p>
                <ul>
                    <li>Odds of 2.00 mean a 1 unit bet returns 2 units (1 unit profit + 1 unit stake)</li>
                    <li>Odds of 1.50 mean a 1 unit bet returns 1.50 units (0.50 unit profit + 1 unit stake)</li>
                </ul>
                <p>However, sportsbooks typically do not offer fair odds because they need to make a profit.</p>
                <img src="assets/images/decimal-odds.png" alt="Decimal odds explanation diagram" class="strategy-image">
            </section>

            <section class="strategy-section">
                <h3>The Role of the Sportsbook's Vig (Commission)</h3>
                <p>Example:</p>
                <p>A sporting event has the following initial decimal odds:</p>
                <ul>
                    <li>Outcome A: 1.90</li>
                    <li>Outcome B: 1.90</li>
                </ul>

                <h4>Understanding Vig (Vigorish or Juice)</h4>
                <p>The vig is the sportsbook's commission, ensuring they make money regardless of the outcome.</p>
                <p>To see how vig works, convert the decimal odds into implied probabilities using the formula:</p>
                <ul>
                    <li>Outcome A: 1 / 1.90 = 0.5263 (52.63%)</li>
                    <li>Outcome B: 1 / 1.90 = 0.5263 (52.63%)</li>
                </ul>
                <div class="strategy-highlight">
                    <p>The total probability sums to 105.26%, instead of 100%, meaning the extra 5.26% represents the sportsbook's built-in edge.</p>
                </div>
                <p>If the true probability of each outcome is 50%, the sportsbook effectively inflates the implied probability, ensuring a profit over time.</p>
                <img src="assets/images/vig-explanation.png" alt="Visual explanation of vigorish" class="strategy-image">
            </section>

            <section class="strategy-section">
                <h3>How Super Boosts Create Value</h3>
                <p>Now, let's explore how a super boost can shift the odds in your favor.</p>
                <p>Scenario:</p>
                <ul>
                    <li>The sportsbook offers a super boost on Outcome A, increasing the odds from 1.90 to 2.50</li>
                    <li>The true probability of Outcome A (after removing the vig) is 50% (0.50)</li>
                </ul>

                <h4>Expected Value (EV) Calculation</h4>
                <p>EV helps determine if a bet is profitable in the long run. The formula for EV is:</p>
                <div class="formula">
                    <p>EV = (Probability of winning × Profit) - (Probability of losing × Stake)</p>
                </div>

                <p>Applying the Formula:</p>
                <ul>
                    <li>Profit = Boosted odds - 1 = 2.50 - 1 = 1.50</li>
                    <li>Probability of winning = 0.50</li>
                    <li>Probability of losing = 0.50</li>
                    <li>Stake = 1 unit (for example purposes)</li>
                </ul>

                <div class="formula">
                    <p>EV = (0.50 × 1.50) - (0.50 × 1)</p>
                    <p>EV = 0.75 - 0.50</p>
                    <p>EV = 0.25</p>
                </div>

                <p>An EV of 0.25 means that, on average, for every 1 unit bet on Outcome A at the boosted odds of 2.50, you can expect to profit 0.25 units in the long run.</p>
                <img src="assets/images/ev-calculation.png" alt="Expected Value calculation example" class="strategy-image">
            </section>

            <section class="strategy-section">
                <h3>Conclusion</h3>
                <p>Super boosts present an opportunity to place bets with a positive expected value (EV), meaning they are mathematically favorable over time. While sportsbooks offer these boosts as a marketing tool, disciplined bettors who focus solely on super boosts can take advantage of these temporary edges. By understanding EV and avoiding additional unfavorable bets, you can increase your profitability and make the most of super boost promotions.</p>
                <div class="strategy-highlight">
                    <p>Remember: The key to success is discipline - stick to betting only on super boosts with positive EV and avoid the temptation of regular bets with negative EV.</p>
                </div>
                <img src="assets/images/profit-graph.png" alt="Long-term profit potential with super boosts" class="strategy-image">
            </section>
        </article>
    `;
} 