import { supabaseClient } from '../api/supabase.js';
import { loadNewBetForm } from '../components/newBet.js';
import { loadBetHistory } from '../components/betHistory.js';
import { loadDashboard, loadUserData } from '../components/dashboard.js';
import { loadSuperBoostStrategy } from '../components/strategy.js';
import { loadTips } from '../components/tips.js';

// Function to handle navigation
async function handleNavigation(targetId) {
  const contentSection = document.getElementById('content');

  // Update active navigation link
  updateActiveNavLink(targetId);

  // If no specific target or 'home' is provided, default to home
  if (!targetId || targetId === '' || targetId === 'home') {
    targetId = 'home';
  }

  // Check authentication for protected routes
  if (['new-bet', 'bet-history', 'dashboard', 'tips'].includes(targetId)) {
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
  switch (targetId) {
    case 'home':
      if (sessionStorage.getItem('userProfile')) {
        loadUserData();
      } else {
        contentSection.innerHTML = `
                    <h2>Welcome to Your Betting Headquarters</h2>
                    <p>Please sign in to get started with tracking your bets.</p>
                    <p>This application allows you to:</p>
                    <ul>
                        <li>Track all your betting activities</li>
                        <li>Analyze your betting performance</li>
                        <li>Follow specialized betting strategies</li>
                        <li>View comprehensive statistics and charts</li>
                        <li>Share and discover betting tips from the community</li>
                    </ul>
                `;
      }
      break;
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
    case 'tips':
      // Set up the tips page structure
      contentSection.innerHTML = `
        <div class="tips-container">
          <h2>Shared Tips</h2>
          <div class="table-container">
            <table class="bet-table">
              <thead>
                <tr>
                  <th class="sortable" data-sort="date">Date</th>
                  <th>Tipper</th>
                  <th>Website</th>
                  <th>Description</th>
                  <th class="sortable" data-sort="odds">Odds</th>
                  <th class="sortable" data-sort="boosted_odds">Boosted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="tipsContainer">
                <tr>
                  <td colspan="7" class="loading">Loading tips...</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination-controls">
            <button id="prevPage" disabled>Previous</button>
            <span id="page-info">Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
            <button id="nextPage" disabled>Next</button>
          </div>
        </div>
      `;
      
      // Use requestAnimationFrame to ensure DOM is painted before proceeding
      requestAnimationFrame(() => {
        // Double-check in a setTimeout to ensure browser has completed all tasks
        setTimeout(() => {
          loadTips();
        }, 50);
      });
      break;
    default:
      // If unknown route, redirect to home
      handleNavigation('home');
  }
}

// Function to update the active navigation link
function updateActiveNavLink(targetId) {
  // Default to home if no target specified
  if (!targetId || targetId === '') {
    targetId = 'home';
  }

  // Remove active class from all navigation links
  const navLinks = document.querySelectorAll('.header-nav ul li a');
  navLinks.forEach((link) => {
    link.classList.remove('active');
  });

  // Add active class to current page link
  const currentLink = document.querySelector(`.header-nav ul li a[href="#${targetId}"]`);
  if (currentLink) {
    currentLink.classList.add('active');
  }
}

// Export the handleNavigation function
export { handleNavigation };
