import { fetchBets } from '../api/api.js';
import { supabaseClient } from '../api/supabase.js';
import { showNotification } from '../utils/utils.js';
import { handleNavigation } from '../views/router.js';

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
        expectedValue: 0
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
        
        <!-- Monthly Performance -->
        <section class="dashboard-section">
            <h3>Monthly Performance</h3>
            ${monthlyPerformanceData.length > 0
    ? `<div class="chart-container">
                    <canvas id="monthlyPerformanceChart"></canvas>
                </div>`
    : `<div class="no-data-message">
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
                                <span class="label">Expected Value:</span>
                                <span class="value ${stats.expectedValue >= 0 ? 'positive' : 'negative'}">
                                    €${stats.expectedValue.toFixed(2)}
                                </span>
                            </div>
                            <div class="stat-item">
                                <span class="label">Record:</span>
                                <span class="value">${stats.wins}W-${stats.losses}L-${stats.pending}P</span>
                            </div>
                            <div class="stat-item">
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
    initializeMonthlyPerformanceChart(monthlyPerformanceData);
  }
}

// Function to prepare data for cumulative profit chart
function prepareCumulativeProfitData(bets) {
  // Filter out pending bets and sort by date
  const completedBets = bets
    .filter((bet) => bet.outcome !== 'pending')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (completedBets.length < 2) {
    return { labels: [], data: [], evData: [] };
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
  let cumulativeProfit = 0;
  let cumulativeEV = 0;

  // Process dates in chronological order
  Object.keys(betsByDate)
    .sort((a, b) => new Date(a) - new Date(b))
    .forEach((date) => {
      let dailyProfit = 0;
      let dailyEV = 0;

      // Calculate profit and EV for all bets on this date
      betsByDate[date].forEach((bet) => {
        // Calculate actual profit
        if (bet.outcome === 'win') {
          const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
          const stake = parseFloat(bet.amount);
          const totalPayout = stake * odds;
          dailyProfit += totalPayout - stake; // Subtract stake to get actual profit
        } else if (bet.outcome === 'loss') {
          dailyProfit -= parseFloat(bet.amount);
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

      labels.push(date);
      data.push(cumulativeProfit.toFixed(2));
      evData.push(cumulativeEV.toFixed(2));
    });

  return { labels, data, evData };
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
            color: 'rgba(0, 0, 0, 0.05)'
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
function initializeMonthlyPerformanceChart(monthlyPerformanceData) {
  const ctx = document.getElementById('monthlyPerformanceChart').getContext('2d');

  // Prepare data for chart
  const months = monthlyPerformanceData.map((data) => data.month).reverse();
  const profits = monthlyPerformanceData.map((data) => data.profit.toFixed(2)).reverse();

  // Determine colors based on profit values
  const barColors = profits.map((profit) => (parseFloat(profit) >= 0 ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)'));

  const barBorderColors = profits.map((profit) => (parseFloat(profit) >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(231, 76, 60, 1)'));

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
            title(context) {
              return context[0].label;
            },
            label(context) {
              const value = parseFloat(context.raw);
              const sign = value >= 0 ? '+' : '';
              const monthData = monthlyPerformanceData[monthlyPerformanceData.length - 1 - context.dataIndex];

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

export {
  loadUserData,
  loadDashboard,
  applyDashboardFilters
};
