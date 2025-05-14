import { fetchBets } from '../api/api.js';
import supabaseClient from '../api/supabase.js';

// Add date filter variables
let startDateFilter = null;
let endDateFilter = null;

// Function to load user-specific data
async function loadUserData() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userBets = await fetchBets(user.id);

    // Get user profile from session storage
    const userProfile = JSON.parse(sessionStorage.getItem('userProfile'));

    // Calculate active (pending) and completed bets
    const activeBets = userBets.filter((bet) => bet.outcome === 'pending').length;
    const completedBets = userBets.filter((bet) => bet.outcome !== 'pending').length;

    // Calculate total profit/loss
    const totalProfitLoss = userBets.reduce((total, bet) => {
      if (bet.outcome === 'pending') return total;

      if (bet.outcome === 'win') {
        const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
        const stake = parseFloat(bet.amount);
        const totalPayout = stake * odds;
        const profit = totalPayout - stake;
        return total + profit;
      } if (bet.outcome === 'loss') {
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
                <button class="btn-primary" onclick="window.app.handleNavigation('new-bet')">Place New Bet</button>
                <button class="btn-secondary" onclick="window.app.handleNavigation('dashboard')">View Dashboard</button>
            </div>
        `;
  } catch (error) {
    console.error('Error loading user data:', error);
    const contentSection = document.getElementById('content');
    const userProfile = JSON.parse(sessionStorage.getItem('userProfile')) || { name: 'User' };
    contentSection.innerHTML = `
            <h2>Welcome back, ${userProfile.name}!</h2>
            <p>Error loading your betting statistics. Please try again later.</p>
            <button class="btn-primary" onclick="window.app.loadUserData()">Retry</button>
        `;
  }
}

// Setup date inputs with today's date as max
function setupDashboardDateFilters() {
  const startDateInput = document.getElementById('dashboard-start-date');
  const endDateInput = document.getElementById('dashboard-end-date');

  if (!startDateInput || !endDateInput) return;

  // Set max date to today
  const today = new Date();
  const todayFormatted = today.toISOString().split('T')[0];
  startDateInput.max = todayFormatted;
  endDateInput.max = todayFormatted;

  // No default dates - leave empty by default
  startDateInput.value = '';
  endDateInput.value = '';

  // Update filters when dates change
  startDateInput.addEventListener('change', () => {
    startDateFilter = startDateInput.value ? new Date(startDateInput.value) : null;
    // Ensure end date is not before start date
    if (startDateFilter && endDateInput.value) {
      const endDate = new Date(endDateInput.value);
      if (endDate < startDateFilter) {
        endDateInput.value = startDateInput.value;
        endDateFilter = new Date(startDateInput.value);
      }
    }
    applyDashboardFilters();
  });

  endDateInput.addEventListener('change', () => {
    endDateFilter = endDateInput.value ? new Date(endDateInput.value) : null;
    // Ensure start date is not after end date
    if (endDateFilter && startDateInput.value) {
      const startDate = new Date(startDateInput.value);
      if (startDate > endDateFilter) {
        startDateInput.value = endDateInput.value;
        startDateFilter = new Date(endDateInput.value);
      }
    }
    applyDashboardFilters();
  });

  // Initialize filter variables to null (no filter)
  startDateFilter = null;
  endDateFilter = null;

  // Add clear filters button event listener
  const clearFiltersBtn = document.getElementById('dashboard-clear-dates');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      startDateInput.value = '';
      endDateInput.value = '';
      startDateFilter = null;
      endDateFilter = null;
      applyDashboardFilters();
    });
  }
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
                <button class="btn-primary" onclick="window.app.handleNavigation('new-bet')">Place Your First Bet</button>
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
                <button id="search-button" class="btn-secondary">Search</button>
            </div>
        `;

    // Create date filter component
    const dateFilter = `
            <div class="date-filter-container">
                <div class="date-filter-label">Date Range:</div>
                <div class="date-inputs">
                    <input type="date" id="dashboard-start-date" placeholder="Start Date">
                    <span>to</span>
                    <input type="date" id="dashboard-end-date" placeholder="End Date">
                    <button id="dashboard-clear-dates" class="btn-secondary">Clear</button>
                </div>
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
                <div class="controls-row filter-controls">
                    ${searchInput}
                    ${dateFilter}
                </div>
            </div>

            <div class="dashboard-container" id="dashboard-content">
                <!-- Content will be updated by applyDashboardFilters -->
            </div>
        `;

    // Add event listeners for filters
    document.querySelectorAll('.filter-btn').forEach((button) => {
      button.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach((btn) => {
          btn.classList.remove('active');
        });
        this.classList.add('active');
        applyDashboardFilters();
      });
    });

    // Add event listener for search
    document.getElementById('search-button').addEventListener('click', () => {
      applyDashboardFilters();
    });

    const searchInputField = document.getElementById('bet-search');
    if (searchInputField) {
      searchInputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          applyDashboardFilters();
        }
      });
    }

    // Setup date filters
    setupDashboardDateFilters();

    // Initial load with all bets
    applyDashboardFilters();
  } catch (error) {
    console.error('Error loading dashboard:', error);
    contentSection.innerHTML = `
            <h2>Dashboard</h2>
            <p>Error loading betting statistics. Please try again later.</p>
            <button class="btn-primary" onclick="window.app.loadDashboard()">Retry</button>
        `;
  }
}

// Function to apply dashboard filters
function applyDashboardFilters() {
  const outcomeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
  const searchTerm = document.getElementById('bet-search').value.toLowerCase();

  // Filter bets
  const filteredBets = window.dashboardBets.filter((bet) => {
    // Apply outcome filter
    if (outcomeFilter !== 'all' && bet.outcome !== outcomeFilter) {
      return false;
    }

    // Apply search filter
    if (searchTerm && !bet.website.toLowerCase().includes(searchTerm)
            && !bet.description.toLowerCase().includes(searchTerm)
            && !(bet.note && bet.note.toLowerCase().includes(searchTerm))) {
      return false;
    }

    // Apply date filter if set
    if (startDateFilter || endDateFilter) {
      const betDate = new Date(bet.date);

      // Check if date is within range
      if (startDateFilter && betDate < startDateFilter) {
        return false;
      }

      if (endDateFilter) {
        // Set time to end of day for the end date
        const endOfDay = new Date(endDateFilter);
        endOfDay.setHours(23, 59, 59, 999);

        if (betDate > endOfDay) {
          return false;
        }
      }
    }

    return true;
  });

  // Calculate statistics based on filtered bets
  const totalBets = filteredBets.length;
  const totalAmount = filteredBets.reduce((total, bet) => total + parseFloat(bet.amount), 0);
  const wins = filteredBets.filter((bet) => bet.outcome === 'win').length;
  const winRate = totalBets > 0 ? ((wins / totalBets) * 100).toFixed(1) : '0.0';

  const totalProfitLoss = filteredBets.reduce((total, bet) => {
    if (bet.outcome === 'pending') return total;

    if (bet.outcome === 'win') {
      const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
      const stake = parseFloat(bet.amount);
      const totalPayout = stake * odds;
      return total + (totalPayout - stake);
    } if (bet.outcome === 'loss') {
      return total - parseFloat(bet.amount);
    }
    return total;
  }, 0);

  // Calculate total expected value
  const totalExpectedValue = filteredBets.reduce((total, bet) => {
    const baseOdds = parseFloat(bet.odds);
    const boostedOdds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : baseOdds;
    const amount = parseFloat(bet.amount);
    const expectedValue = (0.95 / baseOdds) * boostedOdds * amount - amount;
    return total + expectedValue;
  }, 0);

  const roi = totalAmount > 0 ? ((totalProfitLoss / totalAmount) * 100).toFixed(1) : '0.0';

  // Group bets by website
  const websiteStats = {};
  filteredBets.forEach((bet) => {
    if (!websiteStats[bet.website]) {
      websiteStats[bet.website] = {
        totalBets: 0,
        totalAmount: 0,
        wins: 0,
        losses: 0,
        pending: 0,
        profitLoss: 0,
        expectedValue: 0,
        nonBoostedProfit: 0,
        boostImpact: 0
      };
    }

    const stats = websiteStats[bet.website];
    stats.totalBets++;
    stats.totalAmount += parseFloat(bet.amount);

    if (bet.outcome === 'win') {
      stats.wins++;
      // Calculate actual profit with boosted odds
      const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
      const stake = parseFloat(bet.amount);
      const totalPayout = stake * odds;
      stats.profitLoss += totalPayout - stake;
      
      // Calculate non-boosted profit
      const baseOdds = parseFloat(bet.odds);
      const nonBoostedPayout = stake * baseOdds;
      const nonBoostedProfit = nonBoostedPayout - stake;
      stats.nonBoostedProfit += nonBoostedProfit;
      
      // Calculate the boost impact (difference between boosted and non-boosted profit)
      const boostImpact = (totalPayout - stake) - nonBoostedProfit;
      stats.boostImpact += boostImpact;
    } else if (bet.outcome === 'loss') {
      stats.losses++;
      stats.profitLoss -= parseFloat(bet.amount);
      stats.nonBoostedProfit -= parseFloat(bet.amount);
      // No boost impact on losses
    } else {
      stats.pending++;
    }

    // Calculate and add expected value for this bet
    const baseOdds = parseFloat(bet.odds);
    const boostedOdds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : baseOdds;
    const amount = parseFloat(bet.amount);
    const expectedValue = (0.95 / baseOdds) * boostedOdds * amount - amount;
    stats.expectedValue += expectedValue;
  });

  // Prepare chart data
  const chartData = prepareCumulativeProfitData(filteredBets);
  const monthlyPerformanceData = calculateMonthlyPerformance(filteredBets);
  const weeklyPerformanceData = calculateWeeklyPerformance(filteredBets);
  const dailyPerformanceData = calculateDailyPerformance(filteredBets);
  const evProfitData = prepareEVProfitData(filteredBets);

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
                   <div class="stat-box ${totalExpectedValue >= 0 ? 'positive' : 'negative'}">
                    <div class="stat-value">€${totalExpectedValue.toFixed(2)}</div>
                    <div class="stat-label">Expected Value</div>
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
            <h3>Cumulative Profit & Expected Value Over Time</h3>
            ${chartData.labels.length > 0
    ? `<div class="chart-container">
                    <canvas id="profitChart"></canvas>
                </div>`
    : `<div class="no-data-message">
                    <p>Not enough completed bets to display profit chart.</p>
                </div>`
}
        </section>
        
        <!-- Side-by-side charts -->
        <div class="charts-row">
            <!-- EV vs Profit Chart -->
            <section class="dashboard-section chart-half">
                <h3>Expected Value vs Actual Profit</h3>
                ${evProfitData.data.length > 0
    ? `<div class="chart-controls">
                        <div class="toggle-container">
                            <span>View:</span>
                            <div class="toggle-buttons">
                                <button id="absolute-view" class="toggle-btn active">Absolute (€)</button>
                                <button id="normalized-view" class="toggle-btn">Per € Staked</button>
                            </div>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="evProfitChart"></canvas>
                    </div>`
    : `<div class="no-data-message">
                        <p>Not enough completed bets to display EV vs Profit chart.</p>
                    </div>`
}
            </section>
            
            <!-- Performance Over Time -->
            <section class="dashboard-section chart-half">
                <h3>Performance Over Time</h3>
                ${monthlyPerformanceData.length > 0
                  ? `<div class="chart-controls">
                        <div class="toggle-container">
                            <span>View:</span>
                            <div class="toggle-buttons">
                                <button id="monthly-view" class="toggle-btn active">Monthly</button>
                                <button id="weekly-view" class="toggle-btn">Weekly</button>
                                <button id="daily-view" class="toggle-btn">Daily</button>
                            </div>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="performanceChart"></canvas>
                    </div>`
                  : `<div class="no-data-message">
                        <p>Not enough data to display performance chart.</p>
                    </div>`
                }
            </section>
        </div>
                
        <!-- Website Performance -->
        <section class="dashboard-section">
            <h3>Website Performance</h3>
            <style>
                /* Custom CSS for arranging stat items in specific order */
                .stat-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    grid-template-areas:
                        "total-bets expected-value"
                        "win-rate non-boosted"
                        "record boost-impact"
                        "amount profit-loss";
                    gap: 15px;
                }
                .total-bets { grid-area: total-bets; }
                .expected-value { grid-area: expected-value; }
                .win-rate { grid-area: win-rate; }
                .non-boosted { grid-area: non-boosted; }
                .record { grid-area: record; }
                .boost-impact { grid-area: boost-impact; }
                .amount { grid-area: amount; }
                .profit-loss { grid-area: profit-loss; }
            </style>
            <div class="website-stats">
                ${Object.entries(websiteStats).map(([website, stats]) => `
                    <div class="website-stat-card">
                        <h4>${website}</h4>
                        <div class="stat-grid">
                            <div class="stat-item total-bets">
                                <span class="label">Total Bets:</span>
                                <span class="value">${stats.totalBets}</span>
                            </div>
                            <div class="stat-item expected-value">
                                <span class="label">Expected Value:</span>
                                <span class="value ${stats.expectedValue >= 0 ? 'positive' : 'negative'}">
                                    €${stats.expectedValue.toFixed(2)}
                                </span>
                            </div>
                            <div class="stat-item win-rate">
                                <span class="label">Win Rate:</span>
                                <span class="value">${stats.totalBets > 0 ? ((stats.wins / stats.totalBets) * 100).toFixed(1) : '0.0'}%</span>
                            </div>
                            <div class="stat-item non-boosted">
                                <span class="label">Without Boosts:</span>
                                <span class="value ${stats.nonBoostedProfit >= 0 ? 'positive' : 'negative'}">
                                    €${stats.nonBoostedProfit.toFixed(2)}
                                </span>
                            </div>
                            <div class="stat-item record">
                                <span class="label">Record:</span>
                                <span class="value">${stats.wins}W-${stats.losses}L-${stats.pending}P</span>
                            </div>
                            <div class="stat-item boost-impact">
                                <span class="label">Boost Impact:</span>
                                <span class="value ${stats.boostImpact > 0 ? 'positive' : stats.boostImpact < 0 ? 'negative' : ''}">
                                    ${stats.boostImpact > 0 ? '+' : ''}€${stats.boostImpact.toFixed(2)}
                                </span>
                            </div>
                            <div class="stat-item amount">
                                <span class="label">Total Amount:</span>
                                <span class="value">€${stats.totalAmount.toFixed(2)}</span>
                            </div>
                            <div class="stat-item profit-loss">
                                <span class="label">Profit/Loss:</span>
                                <span class="value ${stats.profitLoss >= 0 ? 'positive' : 'negative'}">
                                    €${stats.profitLoss.toFixed(2)}
                                </span>
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
                ${filteredBets.slice(0, 5).map((bet) => {
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
                                <span class="recent-bet-outcome ${bet.outcome}">${bet.outcome === 'pending' ? 'Pending' : bet.outcome === 'win' ? 'Win' : 'Loss'}</span>
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
                <button class="btn-secondary" onclick="window.app.handleNavigation('bet-history')">View All Bets</button>
            </div>
        </section>
    `;

  // Initialize charts if we have data
  if (chartData.labels.length > 0) {
    initializeProfitChart(chartData);
  }

  if (monthlyPerformanceData.length > 0) {
    initializePerformanceChart(monthlyPerformanceData, 'monthly'); // Initialize with monthly view by default

    // Add event listeners for toggle buttons
    document.getElementById('monthly-view').addEventListener('click', () => {
      document.getElementById('monthly-view').classList.add('active');
      document.getElementById('weekly-view').classList.remove('active');
      document.getElementById('daily-view').classList.remove('active');
      initializePerformanceChart(monthlyPerformanceData, 'monthly');
    });

    document.getElementById('weekly-view').addEventListener('click', () => {
      document.getElementById('weekly-view').classList.add('active');
      document.getElementById('monthly-view').classList.remove('active');
      document.getElementById('daily-view').classList.remove('active');
      initializePerformanceChart(weeklyPerformanceData, 'weekly');
    });

    document.getElementById('daily-view').addEventListener('click', () => {
      document.getElementById('daily-view').classList.add('active');
      document.getElementById('monthly-view').classList.remove('active');
      document.getElementById('weekly-view').classList.remove('active');
      initializePerformanceChart(dailyPerformanceData, 'daily');
    });
  }

  if (evProfitData.data.length > 0) {
    initializeEVProfitChart(evProfitData, false); // Initialize with absolute values by default

    // Add event listeners for toggle buttons
    document.getElementById('absolute-view').addEventListener('click', () => {
      document.getElementById('absolute-view').classList.add('active');
      document.getElementById('normalized-view').classList.remove('active');
      initializeEVProfitChart(evProfitData, false);
    });

    document.getElementById('normalized-view').addEventListener('click', () => {
      document.getElementById('normalized-view').classList.add('active');
      document.getElementById('absolute-view').classList.remove('active');
      initializeEVProfitChart(evProfitData, true);
    });
  }
}

// Function to prepare data for cumulative profit chart
function prepareCumulativeProfitData(bets) {
  // Filter out pending bets and sort by date
  const completedBets = bets
    .filter((bet) => bet.outcome !== 'pending')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (completedBets.length < 2) {
    return { labels: [], data: [], evData: [], nonBoostedData: [] };
  }

  // Group bets by date
  const betsByDate = {};

  completedBets.forEach((bet) => {
    const date = new Date(bet.date).toLocaleDateString();

    if (!betsByDate[date]) {
      betsByDate[date] = [];
    }

    betsByDate[date].push(bet);
  });

  // Calculate profit/loss and EV for each date
  const labels = [];
  const data = [];
  const evData = [];
  const nonBoostedData = [];
  let cumulativeProfit = 0;
  let cumulativeEV = 0;
  let cumulativeNonBoostedProfit = 0;

  // Process dates in chronological order
  Object.keys(betsByDate)
    .sort((a, b) => new Date(a) - new Date(b))
    .forEach((date) => {
      let dailyProfit = 0;
      let dailyEV = 0;
      let dailyNonBoostedProfit = 0;

      // Calculate profit and EV for all bets on this date
      betsByDate[date].forEach((bet) => {
        // Calculate actual profit
        if (bet.outcome === 'win') {
          const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
          const stake = parseFloat(bet.amount);
          const totalPayout = stake * odds;
          dailyProfit += totalPayout - stake; // Subtract stake to get actual profit
          
          // Calculate non-boosted profit (always use base odds)
          const baseOdds = parseFloat(bet.odds);
          const nonBoostedPayout = stake * baseOdds;
          dailyNonBoostedProfit += nonBoostedPayout - stake;
        } else if (bet.outcome === 'loss') {
          dailyProfit -= parseFloat(bet.amount);
          dailyNonBoostedProfit -= parseFloat(bet.amount); // Same for losses
        }

        // Calculate expected value
        const baseOdds = parseFloat(bet.odds);
        const boostedOdds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : baseOdds;
        const amount = parseFloat(bet.amount);
        const expectedValue = (0.95 / baseOdds) * boostedOdds * amount - amount;
        dailyEV += expectedValue;
      });

      // Add to cumulative profit and EV
      cumulativeProfit += dailyProfit;
      cumulativeEV += dailyEV;
      cumulativeNonBoostedProfit += dailyNonBoostedProfit;

      labels.push(date);
      data.push(cumulativeProfit.toFixed(2));
      evData.push(cumulativeEV.toFixed(2));
      nonBoostedData.push(cumulativeNonBoostedProfit.toFixed(2));
    });

  return { labels, data, evData, nonBoostedData };
}

// Function to initialize the profit chart
function initializeProfitChart(chartData) {
  const ctx = document.getElementById('profitChart').getContext('2d');

  // Determine if the overall trend is positive or negative
  const lastValue = parseFloat(chartData.data[chartData.data.length - 1]);
  const chartColor = lastValue >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(231, 76, 60, 1)';

  // Determine color for EV line
  const lastEVValue = parseFloat(chartData.evData[chartData.evData.length - 1]);
  const evChartColor = lastEVValue >= 0 ? 'rgba(52, 152, 219, 1)' : 'rgba(155, 89, 182, 1)';
  
  // Determine color for non-boosted profit line
  const lastNonBoostedValue = parseFloat(chartData.nonBoostedData[chartData.nonBoostedData.length - 1]);
  const nonBoostedChartColor = lastNonBoostedValue >= 0 ? 'rgba(243, 156, 18, 1)' : 'rgba(192, 57, 43, 1)';

  // Create gradient for the profit line
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, lastValue >= 0 ? 'rgba(46, 204, 113, 0.4)' : 'rgba(231, 76, 60, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: 'Cumulative Profit (€)',
          data: chartData.data,
          borderColor: chartColor,
          backgroundColor: gradient,
          borderWidth: 3,
          pointBackgroundColor: chartColor,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.2,
          cubicInterpolationMode: 'monotone',
          order: 1
        },
        {
          label: 'Profit Without Boosts (€)',
          data: chartData.nonBoostedData,
          borderColor: nonBoostedChartColor,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointBackgroundColor: nonBoostedChartColor,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          fill: false,
          tension: 0.2,
          cubicInterpolationMode: 'monotone',
          order: 3
        },
        {
          label: 'Cumulative Expected Value (€)',
          data: chartData.evData,
          borderColor: evChartColor,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: evChartColor,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          fill: false,
          tension: 0.2,
          cubicInterpolationMode: 'monotone',
          order: 2
        }
      ]
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
          padding: 15,
          cornerRadius: 6,
          displayColors: true,
          callbacks: {
            title(context) {
              return context[0].label;
            },
            label(context) {
              const value = parseFloat(context.raw);
              const valueFormatted = (value >= 0 ? '+€' : '-€') + Math.abs(value).toFixed(2);
              if (context.datasetIndex === 0) {
                return `Actual Profit/Loss: ${valueFormatted}`;
              } else if (context.datasetIndex === 1) {
                return `Without Boosts: ${valueFormatted}`;
              }
              return `Expected Value: ${valueFormatted}`;
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
            padding: { top: 10, bottom: 0 }
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
            color: (context) => {
              if (context.tick.value === 0) {
                return 'rgba(0, 0, 0, 0.5)';
              }
              return 'rgba(0, 0, 0, 0.05)';
            },
            lineWidth: (context) => {
              if (context.tick.value === 0) {
                return 2;
              }
              return 1;
            },
          },
          title: {
            display: true,
            text: 'Value (€)',
            font: {
              size: 14,
              weight: 'bold'
            },
            padding: { top: 0, bottom: 10 }
          },
          ticks: {
            callback(value) {
              const sign = value >= 0 ? '+' : '';
              return `${sign}€${value}`;
            },
            font: {
              size: 12
            }
          },
          // Include zero in the scale to always show the zero line
          beginAtZero: false,
          grace: '5%'
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
  const completedBets = bets.filter((bet) => bet.outcome !== 'pending');

  // Group bets by month
  const monthlyData = {};

  completedBets.forEach((bet) => {
    const date = new Date(bet.date);
    const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;

    if (!monthlyData[monthYear]) {
      monthlyData[monthYear] = {
        totalBets: 0,
        wins: 0,
        losses: 0,
        amountBet: 0,
        profit: 0,
        // Store the date to help with sorting
        date: new Date(date.getFullYear(), date.getMonth(), 1)
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
      data.profit += totalPayout - stake; // Subtract stake to get actual profit
    } else if (bet.outcome === 'loss') {
      data.losses++;
      data.profit -= parseFloat(bet.amount);
    }
  });

  // Convert to array and sort by date (most recent first)
  return Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      period: month, // Add period property to match weekly data format
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

// Function to calculate weekly performance
function calculateWeeklyPerformance(bets) {
  // Skip if no bets
  if (bets.length === 0) {
    return [];
  }

  // Filter out pending bets
  const completedBets = bets.filter((bet) => bet.outcome !== 'pending');

  // Group bets by week
  const weeklyData = {};

  completedBets.forEach((bet) => {
    const date = new Date(bet.date);

    // Get the week number and year
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

    // Format as "Week X, YYYY"
    const weekYear = `Week ${weekNumber}, ${date.getFullYear()}`;

    if (!weeklyData[weekYear]) {
      weeklyData[weekYear] = {
        totalBets: 0,
        wins: 0,
        losses: 0,
        amountBet: 0,
        profit: 0,
        // Store the date to help with sorting
        date: new Date(date)
      };
    }

    const data = weeklyData[weekYear];
    data.totalBets++;
    data.amountBet += parseFloat(bet.amount);

    if (bet.outcome === 'win') {
      data.wins++;
      const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
      const stake = parseFloat(bet.amount);
      const totalPayout = stake * odds;
      data.profit += totalPayout - stake; // Subtract stake to get actual profit
    } else if (bet.outcome === 'loss') {
      data.losses++;
      data.profit -= parseFloat(bet.amount);
    }
  });

  // Convert to array and sort by date (most recent first)
  return Object.entries(weeklyData)
    .map(([week, data]) => ({
      period: week,
      ...data,
      winRate: data.totalBets > 0 ? ((data.wins / data.totalBets) * 100).toFixed(1) : 0,
      roi: data.amountBet > 0 ? ((data.profit / data.amountBet) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.date - a.date); // Sort by date, most recent first
}

// Function to calculate daily performance
function calculateDailyPerformance(bets) {
  // Skip if no bets
  if (bets.length === 0) {
    return [];
  }

  // Filter out pending bets
  const completedBets = bets.filter((bet) => bet.outcome !== 'pending');

  // Group bets by day
  const dailyData = {};

  completedBets.forEach((bet) => {
    const date = new Date(bet.date);
    const dayString = date.toLocaleDateString();

    if (!dailyData[dayString]) {
      dailyData[dayString] = {
        totalBets: 0,
        wins: 0,
        losses: 0,
        amountBet: 0,
        profit: 0,
        // Store the date to help with sorting
        date: new Date(date)
      };
    }

    const data = dailyData[dayString];
    data.totalBets++;
    data.amountBet += parseFloat(bet.amount);

    if (bet.outcome === 'win') {
      data.wins++;
      const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
      const stake = parseFloat(bet.amount);
      const totalPayout = stake * odds;
      data.profit += totalPayout - stake; // Subtract stake to get actual profit
    } else if (bet.outcome === 'loss') {
      data.losses++;
      data.profit -= parseFloat(bet.amount);
    }
  });

  // Convert to array and sort by date (most recent first)
  return Object.entries(dailyData)
    .map(([day, data]) => ({
      period: day,
      ...data,
      winRate: data.totalBets > 0 ? ((data.wins / data.totalBets) * 100).toFixed(1) : 0,
      roi: data.amountBet > 0 ? ((data.profit / data.amountBet) * 100).toFixed(1) : 0
    }))
    .sort((a, b) => b.date - a.date); // Sort by date, most recent first
}

// Function to initialize the performance chart (monthly or weekly)
function initializePerformanceChart(performanceData, viewType) {
  const ctx = document.getElementById('performanceChart').getContext('2d');

  // Clear existing chart if it exists
  if (window.performanceChart && typeof window.performanceChart.destroy === 'function') {
    window.performanceChart.destroy();
  }

  // Prepare data for chart
  const periods = performanceData.map((data) => data.period || data.month).reverse();
  const profits = performanceData.map((data) => data.profit.toFixed(2)).reverse();

  // Determine colors based on profit values
  const barColors = profits.map((profit) => (parseFloat(profit) >= 0 ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)'));
  const barBorderColors = profits.map((profit) => (parseFloat(profit) >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(231, 76, 60, 1)'));

  window.performanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: periods,
      datasets: [{
        label: viewType === 'monthly' ? 'Monthly Profit/Loss (€)' : viewType === 'daily' ? 'Daily Profit/Loss (€)' : 'Weekly Profit/Loss (€)',
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
            title(context) {
              return context[0].label;
            },
            label(context) {
              const value = parseFloat(context.raw);
              const sign = value >= 0 ? '+' : '';
              const periodData = performanceData[performanceData.length - 1 - context.dataIndex];

              return [
                `Profit/Loss: ${sign}€${value.toFixed(2)}`,
                `Bets: ${periodData.totalBets} (${periodData.wins}W-${periodData.losses}L)`,
                `Win Rate: ${periodData.winRate}%`,
                `ROI: ${periodData.roi}%`
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
            text: viewType === 'monthly' ? 'Month' : viewType === 'daily' ? 'Day' : 'Week',
            font: {
              size: 14,
              weight: 'bold'
            }
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
            text: 'Profit/Loss (€)',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            callback(value) {
              const sign = value >= 0 ? '+' : '';
              return `${sign}€${value}`;
            }
          }
        }
      }
    }
  });
}

// Function to prepare data for EV vs Profit scatter plot
function prepareEVProfitData(bets) {
  // Filter out pending bets
  const completedBets = bets.filter((bet) => bet.outcome !== 'pending');

  if (completedBets.length < 3) {
    return { data: [] };
  }

  // Prepare data for scatter plot
  const data = completedBets.map((bet) => {
    // Calculate expected value
    const baseOdds = parseFloat(bet.odds);
    const boostedOdds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : baseOdds;
    const amount = parseFloat(bet.amount);
    const expectedValue = (0.95 / baseOdds) * boostedOdds * amount - amount;
    const expectedValuePerEuro = (0.95 / baseOdds) * boostedOdds - 1;

    // Calculate actual profit/loss
    let actualProfit = 0;
    if (bet.outcome === 'win') {
      const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
      const stake = parseFloat(bet.amount);
      const totalPayout = stake * odds;
      actualProfit = totalPayout - stake;
    } else if (bet.outcome === 'loss') {
      actualProfit = -parseFloat(bet.amount);
    }

    // Calculate profit per euro staked
    const profitPerEuro = actualProfit / amount;

    return {
      x: expectedValue,
      y: actualProfit,
      xNormalized: expectedValuePerEuro,
      yNormalized: profitPerEuro,
      website: bet.website,
      description: bet.description,
      date: new Date(bet.date).toLocaleDateString(),
      outcome: bet.outcome,
      stake: amount
    };
  });

  return { data };
}

// Function to initialize the EV vs Profit chart
function initializeEVProfitChart(evProfitData, normalized = false) {
  const ctx = document.getElementById('evProfitChart').getContext('2d');

  // Clear existing chart if it exists
  if (window.evProfitChart && typeof window.evProfitChart.destroy === 'function') {
    window.evProfitChart.destroy();
  }

  // Calculate trend line data
  const points = evProfitData.data;
  const n = points.length;

  // Prepare data based on view mode (absolute or normalized)
  const chartData = points.map((point) => ({
    x: normalized ? point.xNormalized : point.x,
    y: normalized ? point.yNormalized : point.y,
    website: point.website,
    description: point.description,
    date: point.date,
    outcome: point.outcome,
    stake: point.stake,
    xOriginal: point.x,
    yOriginal: point.y,
    xNormalized: point.xNormalized,
    yNormalized: point.yNormalized
  }));

  // Calculate the sum of x, y, x^2, and xy
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  chartData.forEach((point) => {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  });

  // Calculate slope (m) and y-intercept (b) for the line y = mx + b
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const yIntercept = (sumY - slope * sumX) / n;

  // Find min and max x values to draw the trend line
  const minX = Math.min(...chartData.map((p) => p.x));
  const maxX = Math.max(...chartData.map((p) => p.x));

  // Create trend line points
  const trendLinePoints = [
    { x: minX, y: slope * minX + yIntercept },
    { x: maxX, y: slope * maxX + yIntercept }
  ];

  // Split data into wins and losses for proper legend
  const winData = chartData.filter((point) => point.outcome === 'win');
  const lossData = chartData.filter((point) => point.outcome === 'loss');

  // Create the chart
  window.evProfitChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Wins',
          data: winData,
          backgroundColor: 'rgba(46, 204, 113, 0.7)',
          borderColor: 'rgba(46, 204, 113, 1)',
          borderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'Losses',
          data: lossData,
          backgroundColor: 'rgba(231, 76, 60, 0.7)',
          borderColor: 'rgba(231, 76, 60, 1)',
          borderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'Trend Line',
          data: trendLinePoints,
          type: 'line',
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label(context) {
              const point = context.raw;
              if (!point.website) {
                return `Trend Line: (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
              }

              const evLabel = normalized
                ? `EV per € Staked: ${point.xNormalized.toFixed(2)}`
                : `Expected Value: €${point.xOriginal.toFixed(2)}`;

              const profitLabel = normalized
                ? `Profit per € Staked: ${point.yNormalized.toFixed(2)}`
                : `Actual Profit: €${point.yOriginal.toFixed(2)}`;

              return [
                `Website: ${point.website}`,
                `Date: ${point.date}`,
                `Description: ${point.description}`,
                `Stake: €${point.stake.toFixed(2)}`,
                evLabel,
                profitLabel,
                `Outcome: ${point.outcome === 'win' ? 'Win' : 'Loss'}`
              ];
            }
          }
        },
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: normalized ? 'Expected Value per € Staked' : 'Expected Value (€)',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback(value) {
              return normalized ? value.toFixed(2) : `€${value.toFixed(2)}`;
            }
          }
        },
        y: {
          title: {
            display: true,
            text: normalized ? 'Actual Profit per € Staked' : 'Actual Profit (€)',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            callback(value) {
              return normalized ? value.toFixed(2) : `€${value.toFixed(2)}`;
            }
          }
        }
      }
    }
  });
}

export {
  loadUserData,
  loadDashboard,
  applyDashboardFilters,
  setupDashboardDateFilters
};
