import { fetchBets, deleteBet, updateBetInSupabase } from '../api/api.js';
import supabaseClient from '../api/supabase.js';
import { showNotification } from '../utils/utils.js';
import handleNavigation from '../views/router.js';

// Add pagination variables
let currentPage = 1;
const pageSize = 15; // Number of bets per page
let filteredBets = []; // To store filtered bets for pagination
// Add date filter variables
let startDateFilter = null;
let endDateFilter = null;

// Define all functions before they're used to avoid "used before defined" errors

// Function to calculate the expected value using the formula: 0.95/odds*boosted_odds * amount - amount
function calculateExpectedValue(bet) {
  const baseOdds = parseFloat(bet.odds);
  const boostedOdds = bet.boosted_odds ? parseFloat(bet.boosted_odds) : baseOdds;
  const amount = parseFloat(bet.amount);

  // Calculate expected value: 0.95/odds*boosted_odds * amount - amount
  const expectedValue = (0.95 / baseOdds) * boostedOdds * amount - amount;

  return expectedValue;
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
    cell.addEventListener('mouseenter', () => {
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
    cell.addEventListener('mouseenter', () => {
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

  // Apply sorting: by date (newest first) and then pending bets first
  filteredBets.sort((a, b) => {
    // First compare by date (newest first)
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);

    if (dateA.getTime() !== dateB.getTime()) {
      return dateB - dateA; // Newest first
    }

    // If dates are equal, prioritize pending bets
    if (a.outcome === 'pending' && b.outcome !== 'pending') {
      return -1;
    }
    if (a.outcome !== 'pending' && b.outcome === 'pending') {
      return 1;
    }

    // If both are pending or both are not pending, maintain original order
    return 0;
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

  // Render the current page
  renderCurrentPage();
}

// Setup date inputs with today's date as max
function setupDateFilters() {
  const startDateInput = document.getElementById('start-date-filter');
  const endDateInput = document.getElementById('end-date-filter');

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
    currentPage = 1;
    applyFilters();
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
    currentPage = 1;
    applyFilters();
  });

  // Initialize filter variables to null (no filter)
  startDateFilter = null;
  endDateFilter = null;

  // Add clear filters button event listener
  const clearFiltersBtn = document.getElementById('clear-date-filters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      startDateInput.value = '';
      endDateInput.value = '';
      startDateFilter = null;
      endDateFilter = null;
      currentPage = 1;
      applyFilters();
    });
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
    let formattedProfitLoss;
    if (bet.outcome === 'pending') {
      formattedProfitLoss = '<span class="neutral-dash">-</span>';
    } else {
      formattedProfitLoss = `€${profitLoss >= 0 ? '' : '-'}${Math.abs(profitLoss).toFixed(2)}`;
    }

    // Calculate expected value
    const expectedValue = calculateExpectedValue(bet);
    const formattedEV = `€${expectedValue >= 0 ? '' : '-'}${Math.abs(expectedValue).toFixed(2)}`;

    // Format date
    const betDate = new Date(bet.date);
    const formattedDate = betDate.toLocaleDateString();

    // Determine row class based on outcome - Replace nested ternary with if/else
    let rowClass = 'pending-row';
    if (bet.outcome === 'win') {
      rowClass = 'win-row';
    } else if (bet.outcome === 'loss') {
      rowClass = 'loss-row';
    }

    // Determine outcome text
    let outcomeText;
    if (bet.outcome === 'pending') {
      outcomeText = 'Pending';
    } else if (bet.outcome === 'win') {
      outcomeText = 'Win';
    } else {
      outcomeText = 'Loss';
    }

    // Extract long HTML into variables to avoid line length issues
    const outcomeCellContent = `
      <span class="outcome-display" onclick="window.app.showOutcomeSelect(${bet.id})">
        ${outcomeText}
      </span>
      <select class="outcome-select" style="display: none;" 
        onchange="window.app.updateBetOutcome(${bet.id}, this.value)" 
        onblur="window.app.hideOutcomeSelect(${bet.id})">
        <option value="pending" ${bet.outcome === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="win" ${bet.outcome === 'win' ? 'selected' : ''}>Win</option>
        <option value="loss" ${bet.outcome === 'loss' ? 'selected' : ''}>Loss</option>
      </select>
    `;

    // Function to check if a bet is still valid (in the future)
    function isValidBet(bet) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day
      const betDate = new Date(bet.date);
      betDate.setHours(0, 0, 0, 0); // Reset time to start of day
      return betDate >= today;
    }

    // Function to render bet actions
    function renderBetActions(bet) {
      const actions = [];

      // Only show share tip button for pending bets that are not in the past
      if (bet.outcome === 'pending' && isValidBet(bet)) {
        actions.push(`
          <button class="btn-share-tip" onclick="window.app.shareBetAsTip(${bet.id})" 
            title="Share as Tip" aria-label="Share as Tip"></button>
        `);
      }

      // Add edit button
      actions.push(`
        <button class="btn-edit" onclick="window.app.editBet(${bet.id})" 
          title="Edit Bet" aria-label="Edit Bet"></button>
      `);

      // Add delete button
      actions.push(`
        <button class="btn-delete" onclick="window.app.confirmDeleteBet(${bet.id})" 
          title="Delete Bet" aria-label="Delete Bet"></button>
      `);

      return actions.join('');
    }

    // Determine profit/loss cell class
    let profitLossClass;
    if (bet.outcome === 'pending') {
      profitLossClass = 'pending';
    } else if (profitLoss >= 0) {
      profitLossClass = 'positive';
    } else {
      profitLossClass = 'negative';
    }

    // Build the HTML with fixed line lengths
    return `
      <tr class="${rowClass}" data-bet-id="${bet.id}">
          <td>${formattedDate}</td>
          <td>${bet.website}</td>
          <td class="description-cell" 
              data-description="${bet.description.replace(/"/g, '&quot;')}">
              ${bet.description}
          </td>
          <td>${parseFloat(bet.odds).toFixed(2)}</td>
          <td>${bet.boosted_odds ? parseFloat(bet.boosted_odds).toFixed(2) : '-'}</td>
          <td class="boost-value-cell ${bet.boosted_odds ? 'positive' : 'neutral'}">
            ${bet.boosted_odds
    ? `${(((parseFloat(bet.boosted_odds) - parseFloat(bet.odds)) / parseFloat(bet.odds)) * 100).toFixed(1)}%`
    : '-'
}
          </td>
          <td>€${parseFloat(bet.amount).toFixed(2)}</td>
          <td class="outcome-cell ${bet.outcome}">${outcomeCellContent}</td>
          <td class="profit-loss ${profitLossClass}">
              ${formattedProfitLoss}
          </td>
          <td class="ev-cell ${expectedValue >= 0 ? 'positive' : 'negative'}">
              ${formattedEV}
          </td>
          <td class="note-cell" 
              data-note="${bet.note ? bet.note.replace(/"/g, '&quot;') : '-'}">
              ${bet.note || '-'}
          </td>
          <td class="actions-cell">${renderBetActions(bet)}</td>
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

// Function to sort bets - Updated for pagination
function sortBets(sortBy, direction) {
  // Sort the filteredBets array
  filteredBets.sort((a, b) => {
    // Split let declarations into multiple statements
    let valueA;
    let valueB;

    switch (sortBy) {
      case 'date':
        // First compare by date
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        // If dates are equal, prioritize pending bets
        if (dateA.getTime() === dateB.getTime()) {
          // Pending bets come first, then wins and losses
          if (a.outcome === 'pending' && b.outcome !== 'pending') {
            return -1;
          }
          if (a.outcome !== 'pending' && b.outcome === 'pending') {
            return 1;
          }
          // If both are pending or both are not pending, maintain original order
          return 0;
        }

        // Otherwise sort by date
        valueA = dateA;
        valueB = dateB;
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
      case 'boost_value':
        if (a.boosted_odds && b.boosted_odds) {
          valueA = ((parseFloat(a.boosted_odds) - parseFloat(a.odds)) / parseFloat(a.odds)) * 100;
          valueB = ((parseFloat(b.boosted_odds) - parseFloat(b.odds)) / parseFloat(b.odds)) * 100;
        } else if (a.boosted_odds) {
          valueA = 1;
          valueB = 0;
        } else if (b.boosted_odds) {
          valueA = 0;
          valueB = 1;
        } else {
          valueA = 0;
          valueB = 0;
        }
        break;
      default:
        valueA = 0;
        valueB = 0;
    }

    if (direction === 'asc') {
      return valueA > valueB ? 1 : -1;
    }
    return valueA < valueB ? 1 : -1;
  });

  // Re-render current page
  renderCurrentPage();
}

// Function for deleting bets
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

// Function to confirm delete bet
function confirmDeleteBet(id) {
  // Using confirm is flagged but necessary for this use case
  // eslint-disable-next-line no-alert
  if (window.confirm('Are you sure you want to delete this bet?')) {
    deleteBetById(id);
  }
}

// Update the editBet function
async function editBet(id) {
  try {
    // Get current user and bets
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userBets = await fetchBets(user.id);

    // Find the bet to edit - Fix redeclaration
    const betToEdit = userBets.find((bet) => bet.id === id);

    if (!betToEdit) {
      showNotification('Bet not found.', 'error');
      return;
    }

    // Load the new bet form using dynamic import
    const newBetModule = await import('./newBet.js');
    await newBetModule.loadNewBetForm(betToEdit); // Pass the bet to edit
  } catch (error) {
    console.error('Error editing bet:', error);
    showNotification('Error loading bet for editing. Please try again.', 'error');
  }
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

    // Find the bet to update - Fix redeclaration
    const betToUpdate = userBets.find((bet) => bet.id === betId);

    if (!betToUpdate) {
      showNotification('Bet not found.', 'error');
      return;
    }

    // Create the update data (only updating the outcome)
    const updateData = {
      website: betToUpdate.website,
      description: betToUpdate.description,
      odds: betToUpdate.odds,
      'boosted-odds': betToUpdate.boosted_odds,
      amount: betToUpdate.amount,
      date: betToUpdate.date,
      outcome: newOutcome,
      note: betToUpdate.note
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
      // Break long line into multiple lines
      contentSection.innerHTML = `
                <h2>Bet History</h2>
                <p>You haven't placed any bets yet.</p>
                <button class="btn-primary" 
                  onclick="window.app.handleNavigation('new-bet')">
                  Place Your First Bet
                </button>
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
                <button id="search-button" class="btn-secondary">Search</button>
            </div>
        `;

    // Create date filter component
    const dateFilter = `
            <div class="date-filter-container">
                <div class="date-filter-label">Date Range:</div>
                <div class="date-inputs">
                    <input type="date" id="start-date-filter" placeholder="Start Date">
                    <span>to</span>
                    <input type="date" id="end-date-filter" placeholder="End Date">
                    <button id="clear-date-filters" class="btn-secondary">Clear</button>
                </div>
            </div>
        `;

    // Create and break down the long HTML into parts for readability
    const tableHead = `
      <thead>
        <tr>
          <th class="sortable" data-sort="date" 
            title="Date when the bet was placed">Date <span class="sort-icon">↓</span></th>
          <th title="Betting website or bookmaker">Website</th>
          <th title="Description of the bet">Description</th>
          <th class="sortable" data-sort="odds" 
            title="Original odds for this bet">Odds <span class="sort-icon"></span></th>
          <th class="sortable" data-sort="boosted_odds" 
            title="Boosted odds, if applicable">Boosted <span class="sort-icon"></span></th>
          <th class="sortable" data-sort="boost_value" 
            title="Percentage increase from original to boosted odds">Boost % <span class="sort-icon"></span></th>
          <th class="sortable" data-sort="amount" 
            title="Amount wagered">Amount <span class="sort-icon"></span></th>
          <th title="Current outcome status of the bet">Outcome</th>
          <th class="sortable" data-sort="profit-loss" 
            title="Profit/Loss - your winnings or losses from this bet">
            P/L <span class="sort-icon"></span>
          </th>
          <th class="sortable" data-sort="ev" 
            title="Expected Value - the mathematical expectation of profit/loss in the long run">
            EV <span class="sort-icon"></span>
          </th>
          <th title="Additional notes about the bet">Note</th>
          <th title="Actions you can perform on this bet">Actions</th>
        </tr>
      </thead>
    `;

    // Calculate profit-loss for the footer
    const calculateProfitLossHtml = () => {
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
    };

    // Compute the profit-loss class
    const profitLossClass = userBets.reduce((total, bet) => {
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
    }, 0) >= 0 ? 'positive' : 'negative';

    // Table footer with calculations
    const tableFooter = `
      <tfoot>
        <tr>
          <td colspan="5" class="summary-label">Summary (${userBets.length} bets):</td>
          <td>€${userBets.reduce((total, bet) => total + parseFloat(bet.amount), 0).toFixed(2)}</td>
          <td></td>
          <td class="profit-loss ${profitLossClass}">
              €${calculateProfitLossHtml()}
          </td>
          <td></td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    `;

    // Put it all together
    contentSection.innerHTML = `
      <h2>Bet History</h2>
      
      <div class="history-controls">
        <div class="controls-row">
          ${filterButtons}
        </div>
        <div class="controls-row filter-controls">
          ${searchInput}
          ${dateFilter}
        </div>
      </div>
      
      <div class="table-container">
        <table class="bet-table">
          ${tableHead}
          <tbody id="bet-table-body">
            <!-- Bet rows will be loaded dynamically -->
          </tbody>
          ${tableFooter}
        </table>
      </div>
      
      <div class="pagination-controls">
        <button id="prev-page" class="btn-secondary">Previous</button>
        <span id="page-info">
          Page <span id="current-page">1</span> of <span id="total-pages">1</span>
        </span>
        <button id="next-page" class="btn-secondary">Next</button>
      </div>
    `;

    // Store all bets for filtering
    filteredBets = [...userBets];
    currentPage = 1;

    // Apply initial sorting: by date (newest first) and then pending bets first
    filteredBets.sort((a, b) => {
      // First compare by date (newest first)
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      if (dateA.getTime() !== dateB.getTime()) {
        return dateB - dateA; // Newest first
      }

      // If dates are equal, prioritize pending bets
      if (a.outcome === 'pending' && b.outcome !== 'pending') {
        return -1;
      }
      if (a.outcome !== 'pending' && b.outcome === 'pending') {
        return 1;
      }

      // If both are pending or both are not pending, maintain original order
      return 0;
    });

    // Render the initial page
    renderCurrentPage();

    // Setup date filters
    setupDateFilters();

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

    const searchInputField = document.getElementById('bet-search');
    if (searchInputField) {
      searchInputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          currentPage = 1;
          applyFilters();
        }
      });
    }

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
        // Fix unary operator using operator assignment
        currentPage -= 1;
        renderCurrentPage();
      }
    });

    document.getElementById('next-page').addEventListener('click', () => {
      const totalPages = Math.ceil(filteredBets.length / pageSize);
      if (currentPage < totalPages) {
        // Fix unary operator using operator assignment
        currentPage += 1;
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
