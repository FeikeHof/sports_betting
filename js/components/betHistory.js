import { fetchBets, deleteBet, updateBetInSupabase } from '../api/api.js';
import { supabaseClient } from '../api/supabase.js';
import { showNotification } from '../utils/utils.js';
import { handleNavigation } from '../views/router.js';
import { loadNewBetForm } from './newBet.js';

// Add pagination variables
let currentPage = 1;
const pageSize = 15; // Number of bets per page
let filteredBets = []; // To store filtered bets for pagination

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

    // Store all bets globally for filtering
    window.allBets = [...userBets];

    if (userBets.length === 0) {
      contentSection.innerHTML = `
                <h2>Bet History</h2>
                <p>You haven't placed any bets yet.</p>
                <button class="btn-primary" onclick="window.app.handleNavigation('new-bet')">Place Your First Bet</button>
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

    // Create the HTML for the bet history page, add pagination
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
                            <th class="sortable" data-sort="date" title="Date when the bet was placed">Date <span class="sort-icon">↓</span></th>
                            <th title="Betting website or bookmaker">Website</th>
                            <th title="Description of the bet">Description</th>
                            <th class="sortable" data-sort="odds" title="Original odds for this bet">Odds <span class="sort-icon"></span></th>
                            <th class="sortable" data-sort="boosted_odds" title="Boosted odds, if applicable">Boosted <span class="sort-icon"></span></th>
                            <th class="sortable" data-sort="amount" title="Amount wagered">Amount <span class="sort-icon"></span></th>
                            <th title="Current outcome status of the bet">Outcome</th>
                            <th class="sortable" data-sort="profit-loss" title="Profit/Loss - your winnings or losses from this bet">P/L <span class="sort-icon"></span></th>
                            <th class="sortable" data-sort="ev" title="Expected Value - the mathematical expectation of profit/loss in the long run">EV <span class="sort-icon"></span></th>
                            <th title="Additional notes about the bet">Note</th>
                            <th title="Actions you can perform on this bet">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="bet-table-body">
                        <!-- Bet rows will be loaded dynamically -->
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
    } if (bet.outcome === 'loss') {
      return total - parseFloat(bet.amount);
    }
    return total;
  }, 0) >= 0 ? 'positive' : 'negative'}">
                                €${(() => {
    const totalProfitLoss = userBets.reduce((total, bet) => {
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
    return (totalProfitLoss >= 0 ? '' : '-') + Math.abs(totalProfitLoss).toFixed(2);
  })()}
                            </td>
                            <td></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="pagination-controls">
                <button id="prev-page" class="btn-secondary">Previous</button>
                <span id="page-info">Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
                <button id="next-page" class="btn-secondary">Next</button>
            </div>
        `;

    // Store all bets for filtering
    filteredBets = [...userBets];
    currentPage = 1;

    // Render the initial page
    renderCurrentPage();

    // Add event listeners for filter buttons
    document.querySelectorAll('.filter-btn').forEach((button) => {
      button.addEventListener('click', function () {
        // Remove active class from all buttons
        document.querySelectorAll('.filter-btn').forEach((btn) => {
          btn.classList.remove('active');
        });

        // Add active class to clicked button
        this.classList.add('active');

        // Apply filter and reset to first page
        currentPage = 1;
        applyFilters();
      });
    });

    // Add event listener for search
    document.getElementById('search-button').addEventListener('click', () => {
      currentPage = 1;
      applyFilters();
    });

    // Add event listeners to sortable headers
    document.querySelectorAll('.sortable').forEach((header) => {
      header.addEventListener('click', function () {
        const sortBy = this.getAttribute('data-sort');

        // Check if this header has a sort-icon first
        let sortIcon = this.querySelector('.sort-icon');
        if (!sortIcon) {
          sortIcon = document.createElement('span');
          sortIcon.className = 'sort-icon';
          this.appendChild(sortIcon);
        }

        const currentDirection = sortIcon.textContent === '↓' ? 'desc' : 'asc';
        const newDirection = currentDirection === 'desc' ? 'asc' : 'desc';

        // Reset all sort icons
        document.querySelectorAll('.sort-icon').forEach((icon) => {
          icon.textContent = '';
        });

        // Set the new sort icon
        sortIcon.textContent = newDirection === 'desc' ? '↓' : '↑';

        // Sort the bets
        sortBets(sortBy, newDirection);
      });
    });

    // Add pagination event listeners
    document.getElementById('prev-page').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderCurrentPage();
      }
    });

    document.getElementById('next-page').addEventListener('click', () => {
      const totalPages = Math.ceil(filteredBets.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderCurrentPage();
      }
    });

    // Setup tooltips after rendering the table
    setupTooltips();
  } catch (error) {
    console.error('Error loading bet history:', error);
    contentSection.innerHTML = `
            <h2>Bet History</h2>
            <p>Error loading bets. Please try again later.</p>
            <button class="btn-primary" onclick="window.app.loadBetHistory()">Retry</button>
        `;
  }
}

// Function to render the current page of bets
function renderCurrentPage() {
  const tableBody = document.getElementById('bet-table-body');
  if (!tableBody) return;

  // Calculate page boundaries
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredBets.length);

  // Clear existing rows
  tableBody.innerHTML = '';

  // Render only the bets for the current page
  const currentPageBets = filteredBets.slice(startIndex, endIndex);

  // Generate HTML for each bet
  const betsHTML = currentPageBets.map((bet) => {
    // Calculate profit/loss
    let profitLoss = 0;
    if (bet.outcome === 'win') {
      const odds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : parseFloat(bet.odds);
      const stake = parseFloat(bet.amount);
      const totalPayout = stake * odds;
      profitLoss = totalPayout - stake; // Subtract stake to get actual profit
    } else if (bet.outcome === 'loss') {
      profitLoss = -parseFloat(bet.amount);
    }

    // Format profit/loss for display
    const formattedProfitLoss = bet.outcome === 'pending'
      ? '<span class="neutral-dash">-</span>'
      : `€${profitLoss >= 0 ? '' : '-'}${Math.abs(profitLoss).toFixed(2)}`;

    // Calculate expected value
    const expectedValue = calculateExpectedValue(bet);
    const formattedEV = `€${expectedValue >= 0 ? '' : '-'}${Math.abs(expectedValue).toFixed(2)}`;

    // Format date
    const betDate = new Date(bet.date);
    const formattedDate = betDate.toLocaleDateString();

    // Determine row class based on outcome
    const rowClass = bet.outcome === 'win' ? 'win-row'
      : bet.outcome === 'loss' ? 'loss-row'
        : 'pending-row';

    return `
      <tr class="${rowClass}" data-bet-id="${bet.id}">
          <td>${formattedDate}</td>
          <td>${bet.website}</td>
          <td class="description-cell" data-description="${bet.description.replace(/"/g, '&quot;')}">${bet.description}</td>
          <td>${parseFloat(bet.odds).toFixed(2)}</td>
          <td>${bet.boosted_odds ? parseFloat(bet.boosted_odds).toFixed(2) : '-'}</td>
          <td>€${parseFloat(bet.amount).toFixed(2)}</td>
          <td class="outcome-cell ${bet.outcome}">
            <span class="outcome-display" onclick="window.app.showOutcomeSelect(${bet.id})">${bet.outcome === 'pending' ? 'Pending' : bet.outcome === 'win' ? 'Win' : 'Loss'}</span>
            <select class="outcome-select" style="display: none;" onchange="window.app.updateBetOutcome(${bet.id}, this.value)" onblur="window.app.hideOutcomeSelect(${bet.id})">
              <option value="pending" ${bet.outcome === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="win" ${bet.outcome === 'win' ? 'selected' : ''}>Win</option>
              <option value="loss" ${bet.outcome === 'loss' ? 'selected' : ''}>Loss</option>
            </select>
          </td>
          <td class="profit-loss ${bet.outcome === 'pending' ? 'pending' : (profitLoss >= 0 ? 'positive' : 'negative')}">
              ${formattedProfitLoss}
          </td>
          <td class="ev-cell ${expectedValue >= 0 ? 'positive' : 'negative'}">
              ${formattedEV}
          </td>
          <td class="note-cell" data-note="${bet.note ? bet.note.replace(/"/g, '&quot;') : '-'}">${bet.note || '-'}</td>
          <td class="actions-cell">
              <button class="btn-edit" onclick="window.app.editBet(${bet.id})" title="Edit bet" aria-label="Edit bet"></button>
              <button class="btn-delete" onclick="window.app.confirmDeleteBet(${bet.id})" title="Delete bet" aria-label="Delete bet"></button>
          </td>
      </tr>
    `;
  }).join('');

  // Add the rows to the table
  tableBody.innerHTML = betsHTML;

  // Update pagination info
  const totalPages = Math.max(1, Math.ceil(filteredBets.length / pageSize));
  document.getElementById('current-page').textContent = currentPage;
  document.getElementById('total-pages').textContent = totalPages;

  // Enable/disable pagination buttons
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;

  // Re-setup tooltips for the new rows
  setupTooltips();
}

// Function to apply filters to the bet history
function applyFilters() {
  const outcomeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
  const searchTerm = document.getElementById('bet-search').value.toLowerCase();

  // Get all bets from the original dataset
  const userBets = window.allBets || [];

  // Filter the bets
  filteredBets = userBets.filter((bet) => {
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

  // Update the summary row
  const summaryRow = document.querySelector('.bet-table tfoot tr');
  if (summaryRow) {
    summaryRow.innerHTML = `
            <td colspan="5" class="summary-label">Summary (${totalBets} bets):</td>
            <td>€${totalAmount.toFixed(2)}</td>
            <td></td>
            <td class="profit-loss ${totalProfitLoss >= 0 ? 'positive' : 'negative'}">
                €${totalProfitLoss >= 0 ? '' : '-'}${Math.abs(totalProfitLoss).toFixed(2)}
            </td>
            <td></td>
            <td colspan="2"></td>
        `;
  }

  // Render the current page (will show first page since currentPage is reset)
  renderCurrentPage();
}

// Function to sort bets - Updated for pagination
function sortBets(sortBy, direction) {
  // Sort the filteredBets array
  filteredBets.sort((a, b) => {
    let valueA; let
      valueB;

    switch (sortBy) {
      case 'date':
        valueA = new Date(a.date);
        valueB = new Date(b.date);
        break;
      case 'odds':
        valueA = parseFloat(a.odds);
        valueB = parseFloat(b.odds);
        break;
      case 'boosted_odds':
        valueA = a.boosted_odds ? parseFloat(a.boosted_odds) : parseFloat(a.odds);
        valueB = b.boosted_odds ? parseFloat(b.boosted_odds) : parseFloat(b.odds);
        break;
      case 'amount':
        valueA = parseFloat(a.amount);
        valueB = parseFloat(b.amount);
        break;
      case 'profit-loss':
        // Calculate profit/loss for bet A
        if (a.outcome === 'pending') {
          valueA = -Infinity;
        } else if (a.outcome === 'win') {
          const oddsA = a.boosted_odds ? parseFloat(a.boosted_odds) : parseFloat(a.odds);
          valueA = parseFloat(a.amount) * oddsA - parseFloat(a.amount);
        } else { // loss
          valueA = -parseFloat(a.amount);
        }

        // Calculate profit/loss for bet B
        if (b.outcome === 'pending') {
          valueB = -Infinity;
        } else if (b.outcome === 'win') {
          const oddsB = b.boosted_odds ? parseFloat(b.boosted_odds) : parseFloat(b.odds);
          valueB = parseFloat(b.amount) * oddsB - parseFloat(b.amount);
        } else { // loss
          valueB = -parseFloat(b.amount);
        }
        break;
      case 'ev':
        valueA = calculateExpectedValue(a);
        valueB = calculateExpectedValue(b);
        break;
      default:
        valueA = valueB = 0;
    }

    if (direction === 'asc') {
      return valueA > valueB ? 1 : -1;
    }
    return valueA < valueB ? 1 : -1;
  });

  // Re-render current page
  renderCurrentPage();
}

// Function to setup tooltips for cells with truncated text
function setupTooltips() {
  // Remove any existing tooltips
  document.querySelectorAll('.cell-tooltip').forEach((tooltip) => {
    tooltip.remove();
  });

  // Setup tooltips for description cells
  document.querySelectorAll('.description-cell').forEach((cell) => {
    const description = cell.getAttribute('data-description');
    if (!description) return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'cell-tooltip';
    tooltip.textContent = description;
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // Show tooltip on mouseenter
    cell.addEventListener('mouseenter', (e) => {
      const rect = cell.getBoundingClientRect();

      // Set width before positioning
      tooltip.style.maxWidth = '300px';

      // Position tooltip
      tooltip.style.left = `${rect.left + window.scrollX}px`;

      // Position above or below depending on space
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 200) {
        tooltip.style.top = `${rect.top + window.scrollY - 5}px`;
        tooltip.style.transform = 'translateY(-100%)';
      } else {
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltip.style.transform = 'translateY(0)';
      }

      tooltip.style.display = 'block';
    });

    // Hide tooltip on mouseleave
    cell.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });

  // Setup tooltips for note cells
  document.querySelectorAll('.note-cell').forEach((cell) => {
    const note = cell.getAttribute('data-note');
    if (!note || note === '-') return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'cell-tooltip';
    tooltip.textContent = note;
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // Show tooltip on mouseenter
    cell.addEventListener('mouseenter', (e) => {
      const rect = cell.getBoundingClientRect();

      // Set width before positioning
      tooltip.style.maxWidth = '300px';

      // Position tooltip - align right edge with cell
      tooltip.style.left = 'auto';
      tooltip.style.right = `${window.innerWidth - rect.right - window.scrollX}px`;

      // Position above or below depending on space
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 200) {
        tooltip.style.top = `${rect.top + window.scrollY - 5}px`;
        tooltip.style.transform = 'translateY(-100%)';
      } else {
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
        tooltip.style.transform = 'translateY(0)';
      }

      tooltip.style.display = 'block';
    });

    // Hide tooltip on mouseleave
    cell.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
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
      loadBetHistory();
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
    const bet = userBets.find((bet) => bet.id === id);

    if (!bet) {
      showNotification('Bet not found.', 'error');
      return;
    }

    // Load the new bet form
    await loadNewBetForm(bet); // Pass the bet to edit
  } catch (error) {
    console.error('Error editing bet:', error);
    showNotification('Error loading bet for editing. Please try again.', 'error');
  }
}

// Function to calculate the expected value using the formula: 0.95/odds*boosted_odds * amount - amount
function calculateExpectedValue(bet) {
  const baseOdds = parseFloat(bet.odds);
  const boostedOdds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : baseOdds;
  const amount = parseFloat(bet.amount);

  // Calculate expected value: 0.95/odds*boosted_odds * amount - amount
  const expectedValue = (0.95 / baseOdds) * boostedOdds * amount - amount;

  return expectedValue;
}

// Function to show the outcome select dropdown
function showOutcomeSelect(betId) {
  const row = document.querySelector(`tr[data-bet-id="${betId}"]`);
  if (!row) return;

  const outcomeCell = row.querySelector('.outcome-cell');
  const outcomeDisplay = outcomeCell.querySelector('.outcome-display');
  const outcomeSelect = outcomeCell.querySelector('.outcome-select');

  // Hide display, show select
  outcomeDisplay.style.display = 'none';
  outcomeSelect.style.display = 'block';

  // Focus and open the select
  outcomeSelect.focus();
}

// Function to hide the outcome select dropdown and show the display
function hideOutcomeSelect(betId) {
  const row = document.querySelector(`tr[data-bet-id="${betId}"]`);
  if (!row) return;

  const outcomeCell = row.querySelector('.outcome-cell');
  const outcomeDisplay = outcomeCell.querySelector('.outcome-display');
  const outcomeSelect = outcomeCell.querySelector('.outcome-select');

  // Show display, hide select
  outcomeDisplay.style.display = 'inline-block';
  outcomeSelect.style.display = 'none';
}

// Function to toggle the outcome edit mode - Keeping this for backwards compatibility
function toggleOutcomeEdit(betId) {
  showOutcomeSelect(betId);
}

// Function to update a bet's outcome directly
async function updateBetOutcome(betId, newOutcome) {
  try {
    // Get current user and bets
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userBets = await fetchBets(user.id);

    // Find the bet to update
    const bet = userBets.find((bet) => bet.id === betId);

    if (!bet) {
      showNotification('Bet not found.', 'error');
      return;
    }

    // Create the update data (only updating the outcome)
    const updateData = {
      website: bet.website,
      description: bet.description,
      odds: bet.odds,
      'boosted-odds': bet.boosted_odds,
      amount: bet.amount,
      date: bet.date,
      outcome: newOutcome,
      note: bet.note
    };

    // Update the bet in Supabase
    const success = await updateBetInSupabase(betId, updateData);

    if (success) {
      showNotification('Bet outcome updated successfully!', 'success');

      // Reload the bet history to reflect changes
      loadBetHistory();
    } else {
      showNotification('Error updating bet outcome. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error updating bet outcome:', error);
    showNotification('Error updating bet outcome. Please try again.', 'error');
  }
}

export {
  loadBetHistory,
  confirmDeleteBet,
  deleteBetById,
  editBet,
  applyFilters,
  sortBets,
  toggleOutcomeEdit,
  updateBetOutcome,
  showOutcomeSelect,
  hideOutcomeSelect
};
