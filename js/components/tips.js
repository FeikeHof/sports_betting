import supabaseClient from '../api/supabase.js';
import { showNotification } from '../utils/utils.js';

// Function declarations
let currentPage = 1;
const pageSize = 12;
let filteredTips = [];

// Function to fetch tips from Supabase
async function fetchTips() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Fetch all tips in a single query with proper joins
    const { data: fullTips, error } = await supabaseClient
      .from('tips')
      .select(`
        *,
        bet:bets!inner(
          id,
          website,
          odds,
          boosted_odds,
          description,
          outcome
        ),
        profile:profiles!inner(
          email
        )
      `)
      .or(`is_public.eq.true,tipper_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Store the current user's ID for later use
    window.currentUserId = user.id;

    return fullTips || [];
  } catch (error) {
    console.error('Full error:', error);
    showNotification(`Error fetching tips: ${error.message}`, 'error');
    return [];
  }
}

// Function to share a bet as a tip
async function shareBetAsTip(betId) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `
    <form method="dialog" class="share-tip-form">
      <h3>Share Bet as Tip</h3>
      <p>Are you sure you want to share this bet as a tip?</p>
      <div class="button-group">
        <button type="button" class="btn-secondary" onclick="this.closest('dialog').close()">Cancel</button>
        <button type="submit" class="btn-share-tip" title="Share as Tip" aria-label="Share as Tip"></button>
      </div>
    </form>
  `;

  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();

      // Check if tip already exists for this bet and user
      const { data: existingTips, error: checkError } = await supabaseClient
        .from('tips')
        .select('*')
        .match({ bet_id: betId, tipper_id: user.id });

      if (checkError) throw checkError;

      if (existingTips && existingTips.length > 0) {
        showNotification('You have already shared this bet as a tip', 'error');
        dialog.close();
        dialog.remove();
        return;
      }

      // First, ensure the user has a profile
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        // Mask the email for privacy
        const maskEmail = (email) => {
          if (!email) return 'Anonymous';
          const [username, domain] = email.split('@');
          if (username.length <= 2) return `${username}@${domain}`;
          return `${username.slice(0, 2)}${'*'.repeat(username.length - 2)}@${domain}`;
        };

        // If profile doesn't exist, create it with masked email
        const { error: insertError } = await supabaseClient
          .from('profiles')
          .insert([{
            id: user.id,
            email: maskEmail(user.email)
          }]);

        if (insertError) throw insertError;
      }

      // Now create the tip
      const { error } = await supabaseClient
        .from('tips')
        .insert([{
          bet_id: betId,
          tipper_id: user.id,
          is_public: true
        }]);

      if (error) throw error;
      showNotification('Tip shared successfully!', 'success');

      // Wait a brief moment before reloading tips to ensure DOM is ready
      setTimeout(() => loadTips(), 100);
    } catch (error) {
      console.error('Error sharing tip:', error);
      showNotification(`Error sharing tip: ${error.message}`, 'error');
    }

    dialog.close();
    dialog.remove();
  };
}

// Function to delete a tip
async function deleteTip(tipId) {
  try {
    const { error } = await supabaseClient
      .from('tips')
      .delete()
      .eq('id', tipId);

    if (error) throw error;
    showNotification('Tip deleted successfully!', 'success');
    loadTips(); // Refresh the tips list
  } catch (error) {
    showNotification(`Error deleting tip: ${error.message}`, 'error');
  }
}

// Function to confirm and delete a tip
function confirmDeleteTip(tipId) {
  if (window.confirm('Are you sure you want to delete this tip?')) {
    deleteTip(tipId);
  }
}

// Function to setup event listeners
function setupEventListeners() {
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderCurrentPage();
    }
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredTips.length / pageSize);
    if (currentPage < totalPages) {
      currentPage += 1;
      renderCurrentPage();
    }
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

      // Sort the tips
      sortTips(sortBy, newDirection);
    });
  });
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
}

// Function to check if a tip is still valid (in the future)
function isValidTip(tip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  const tipDate = new Date(tip.created_at);
  tipDate.setHours(0, 0, 0, 0); // Reset time to start of day
  return tipDate >= today;
}

// Function to render current page of tips
function renderCurrentPage() {
  // Filter out past tips
  const validTips = filteredTips.filter(isValidTip);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentTips = validTips.slice(startIndex, endIndex);

  const container = document.getElementById('tipsContainer');

  if (validTips.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="no-tips">
          No active tips available. Check back later for new tips!
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = currentTips.map((tip) => {
    const { bet } = tip;
    const isOwnTip = tip.tipper_id === window.currentUserId;
    const displayName = tip.profile?.email || 'Anonymous';

    const description = bet?.description || 'No description';
    const escapedDesc = description.replace(/"/g, '&quot;');

    const deleteButton = isOwnTip
      ? `<button class="btn-delete" onclick="window.app.confirmDeleteTip(${tip.id})" 
          title="Delete tip" aria-label="Delete tip"></button>`
      : '';

    return `
      <tr>
        <td class="date-cell">${new Date(tip.created_at).toLocaleDateString()}</td>
        <td class="tipper-cell">${displayName}</td>
        <td class="website-cell">${bet?.website || 'Unknown'}</td>
        <td class="description-cell" data-description="${escapedDesc}">
          ${description}
        </td>
        <td class="odds-cell">${bet?.odds ? parseFloat(bet.odds).toFixed(2) : 'N/A'}</td>
        <td class="boosted-cell">${bet?.boosted_odds ? parseFloat(bet.boosted_odds).toFixed(2) : '-'}</td>
        <td class="actions-cell">${deleteButton}</td>
      </tr>
    `;
  }).join('');

  // Update pagination info
  const totalPages = Math.max(1, Math.ceil(validTips.length / pageSize));
  document.getElementById('current-page').textContent = currentPage;
  document.getElementById('total-pages').textContent = totalPages;

  // Enable/disable pagination buttons
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage === totalPages;

  // Setup tooltips
  setupTooltips();
}

// Function to sort tips
function sortTips(sortBy, direction) {
  filteredTips.sort((a, b) => {
    let valueA;
    let valueB;

    switch (sortBy) {
      case 'date':
        valueA = new Date(a.created_at);
        valueB = new Date(b.created_at);
        break;
      case 'odds':
        valueA = a.bet?.odds ? parseFloat(a.bet.odds) : -Infinity;
        valueB = b.bet?.odds ? parseFloat(b.bet.odds) : -Infinity;
        break;
      case 'boosted_odds': {
        const getOdds = (bet) => {
          if (bet?.boosted_odds) return parseFloat(bet.boosted_odds);
          if (bet?.odds) return parseFloat(bet.odds);
          return -Infinity;
        };
        valueA = getOdds(a.bet);
        valueB = getOdds(b.bet);
        break;
      }
      default:
        valueA = 0;
        valueB = 0;
    }

    if (direction === 'asc') {
      return valueA > valueB ? 1 : -1;
    }
    return valueA < valueB ? 1 : -1;
  });

  renderCurrentPage();
}

// Function to update the tips UI
function updateTipsUI(tips) {
  // Store the tips in the filteredTips array for pagination
  filteredTips = tips;

  // Reset to first page when updating tips
  currentPage = 1;

  // Render the current page
  renderCurrentPage();
}

// Function to load tips page
async function loadTips() {
  try {
    // Use the existing fetchTips function that has the correct query structure
    const tips = await fetchTips();

    // Get the container
    const container = document.getElementById('tipsContainer');
    if (!container) {
      console.warn('Tips container not immediately available, waiting for DOM...');
      // Wait for a short time and try again
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryContainer = document.getElementById('tipsContainer');
      if (!retryContainer) {
        console.error('Tips container still not found after retry');
        return;
      }
    }

    // Update the UI with the tips data
    updateTipsUI(tips);

    // Set up event listeners for sorting and pagination
    setupEventListeners();
  } catch (error) {
    console.error('Full error:', error);
    // Show error message to user
    showNotification('Error loading tips', 'error');
  }
}

export {
  loadTips,
  shareBetAsTip,
  confirmDeleteTip,
  updateTipsUI
};
