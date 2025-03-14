import { fetchBets, deleteBet, updateBetInSupabase } from '../api/api.js';
import { supabaseClient } from '../api/supabase.js';
import { showNotification } from '../utils/utils.js';
import { handleNavigation } from '../views/router.js';
import { loadNewBetForm } from './newBet.js';

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
                            <th class="sortable" data-sort="ev">Expected Value (€)</th>
                            <th class="sortable" data-sort="note">Note</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="bet-table-body">
                        ${userBets.map((bet) => {
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
      ? 'Pending'
      : (profitLoss >= 0 ? '+€' : '-€') + Math.abs(profitLoss).toFixed(2);

    // Calculate expected value
    const expectedValue = calculateExpectedValue(bet);
    const formattedEV = expectedValue >= 0
      ? `+€${expectedValue.toFixed(2)}`
      : `-€${Math.abs(expectedValue).toFixed(2)}`;

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
                                    <td class="description-cell">${bet.description}</td>
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
                                    <td class="note-cell">${bet.note || '-'}</td>
                                    <td class="actions-cell">
                                        <button class="btn-edit" onclick="window.app.editBet(${bet.id})" title="Edit bet">Edit</button>
                                        <button class="btn-delete" onclick="window.app.confirmDeleteBet(${bet.id})" title="Delete bet">Delete</button>
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
    } if (bet.outcome === 'loss') {
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
    } if (bet.outcome === 'loss') {
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
  } if (bet.outcome === 'loss') {
    return total - parseFloat(bet.amount);
  }
  return total;
}, 0)).toFixed(2)}
                            </td>
                            <td></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

    // Add event listeners for filter buttons
    document.querySelectorAll('.filter-btn').forEach((button) => {
      button.addEventListener('click', function () {
        // Remove active class from all buttons
        document.querySelectorAll('.filter-btn').forEach((btn) => {
          btn.classList.remove('active');
        });

        // Add active class to clicked button
        this.classList.add('active');

        // Apply filter
        applyFilters();
      });
    });

    // Add event listener for search
    document.getElementById('search-button').addEventListener('click', () => {
      applyFilters();
    });

    // Add event listeners to sortable headers
    document.querySelectorAll('.sortable').forEach((header) => {
      header.addEventListener('click', function () {
        const sortBy = this.getAttribute('data-sort');
        const currentDirection = this.querySelector('.sort-icon').textContent === '↓' ? 'desc' : 'asc';
        const newDirection = currentDirection === 'desc' ? 'asc' : 'desc';

        // Reset all sort icons
        document.querySelectorAll('.sort-icon').forEach((icon) => {
          icon.textContent = '';
        });

        // Set the new sort icon
        this.querySelector('.sort-icon').textContent = newDirection === 'desc' ? '↓' : '↑';

        // Sort the bets
        sortBets(sortBy, newDirection);
      });
    });
  } catch (error) {
    console.error('Error loading bet history:', error);
    contentSection.innerHTML = `
            <h2>Bet History</h2>
            <p>Error loading bets. Please try again later.</p>
            <button class="btn-primary" onclick="window.app.loadBetHistory()">Retry</button>
        `;
  }
}

// Function to apply filters to the bet history
function applyFilters() {
  const outcomeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
  const searchTerm = document.getElementById('bet-search').value.toLowerCase();

  // Get all rows
  const tableRows = document.querySelectorAll('#bet-table-body tr');

  const visibleBets = [];

  // Filter the rows
  tableRows.forEach((row) => {
    const outcome = row.querySelector('.outcome-cell').classList[1];
    const website = row.cells[1].textContent.toLowerCase();
    const description = row.cells[2].textContent.toLowerCase();
    const note = row.cells[9].textContent.toLowerCase();

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
        outcome,
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
    } if (bet.outcome === 'loss') {
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
            <td></td>
            <td colspan="2"></td>
        `;
  }
}

// Function to sort bets
function sortBets(sortBy, direction) {
  const tableBody = document.getElementById('bet-table-body');
  const rows = Array.from(tableBody.querySelectorAll('tr'));

  rows.sort((a, b) => {
    let valueA; let
      valueB;

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
          valueB = parseFloat(textB.replace(/[+€-]/g, ''))
                            * (textB.includes('-') ? -1 : 1);
        } else if (textB === 'Pending') {
          valueA = parseFloat(textA.replace(/[+€-]/g, ''))
                            * (textA.includes('-') ? -1 : 1);
          valueB = -Infinity;
        } else {
          valueA = parseFloat(textA.replace(/[+€-]/g, ''))
                            * (textA.includes('-') ? -1 : 1);
          valueB = parseFloat(textB.replace(/[+€-]/g, ''))
                            * (textB.includes('-') ? -1 : 1);
        }
        break;
      case 'ev':
        const evTextA = a.cells[8].textContent;
        const evTextB = b.cells[8].textContent;
        valueA = parseFloat(evTextA.replace(/[+€-]/g, ''))
                        * (evTextA.includes('-') ? -1 : 1);
        valueB = parseFloat(evTextB.replace(/[+€-]/g, ''))
                        * (evTextB.includes('-') ? -1 : 1);
        break;
      default:
        valueA = valueB = 0;
    }

    if (direction === 'asc') {
      return valueA > valueB ? 1 : -1;
    }
    return valueA < valueB ? 1 : -1;
  });

  // Reorder the rows
  rows.forEach((row) => tableBody.appendChild(row));
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
