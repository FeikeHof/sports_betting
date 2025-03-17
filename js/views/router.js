import supabaseClient from '../api/supabase.js';
// import { loadNewBetForm } from '../components/newBet.js';
// import { loadBetHistory } from '../components/betHistory.js';
import { loadDashboard, loadUserData } from '../components/dashboard.js';
import { loadSuperBoostStrategy } from '../components/strategy.js';
import { loadTips } from '../components/tips.js';

// Function to update the active navigation link
function updateActiveNavLink(targetId) {
  // Default to home if no target specified
  const navTarget = !targetId || targetId === '' ? 'home' : targetId;

  // Remove active class from all navigation links
  const navLinks = document.querySelectorAll('.header-nav ul li a');
  navLinks.forEach((link) => {
    link.classList.remove('active');
  });

  // Add active class to current page link
  const currentLink = document.querySelector(`.header-nav ul li a[href="#${navTarget}"]`);
  if (currentLink) {
    currentLink.classList.add('active');
  }
}

// Function to handle navigation
async function handleNavigation(targetId) {
  const contentSection = document.getElementById('content');

  // Update active navigation link
  updateActiveNavLink(targetId);

  // If no specific target or 'home' is provided, default to home
  const navTarget = !targetId || targetId === '' || targetId === 'home' ? 'home' : targetId;

  // Check authentication for protected routes
  if (['new-bet', 'bet-history', 'dashboard', 'tips'].includes(navTarget)) {
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
  switch (navTarget) {
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
      // Use dynamic import to avoid circular dependencies
      import('../components/newBet.js').then(module => {
        module.loadNewBetForm();
      });
      break;
    case 'bet-history':
      // Use dynamic import to avoid circular dependencies
      import('../components/betHistory.js').then(module => {
        module.loadBetHistory();
      });
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
            <table class="tips-table">
              <thead>
                <tr>
                  <th class="date-cell">Date</th>
                  <th class="tipper-cell">Tipper</th>
                  <th class="website-cell">Website</th>
                  <th class="description-cell">Description</th>
                  <th class="odds-cell">Odds</th>
                  <th class="boosted-cell">Boosted</th>
                  <th class="actions-cell">Actions</th>
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

      // Wait for the DOM to be ready before loading tips
      requestAnimationFrame(() => loadTips());
      break;
    default:
      // If unknown route, redirect to home
      handleNavigation('home');
  }
}

// Export the handleNavigation function
export default handleNavigation;
