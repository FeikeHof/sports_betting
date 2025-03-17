import { fetchBets, updateBetInSupabase } from '../api/api.js';
import { supabaseClient } from '../api/supabase.js';
import { showNotification, validateBetData } from '../utils/utils.js';
import { handleNavigation } from '../views/router.js';

// Function to get unique websites from existing bets
async function getUniqueWebsites() {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const userBets = await fetchBets(user.id);
    const websites = [...new Set(userBets.map((bet) => bet.website))].sort();
    return websites;
  } catch (error) {
    console.error('Error fetching websites:', error);
    return [];
  }
}

// Function to load new bet form
async function loadNewBetForm(betToEdit = null) {
  const contentSection = document.getElementById('content');

  // Get unique websites
  const websites = await getUniqueWebsites();

  // Set form title based on whether we're editing or creating
  const formTitle = betToEdit ? 'Edit Bet' : 'Create New Bet';
  const submitButtonText = betToEdit ? 'Update Bet' : 'Save Bet';

  contentSection.innerHTML = `
        <div class="form-container compact-form">
            <h2>${formTitle}</h2>
            <form id="new-bet-form" class="bet-form" ${betToEdit ? `data-edit-id="${betToEdit.id}"` : ''}>
                <div class="form-section">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="website">Website</label>
                            <div class="website-input-group">
                                <select id="website-select" onchange="window.app.handleWebsiteSelect(this.value)">
                                    <option value="">-- Select Website --</option>
                                    ${websites.map((site) => `
                                        <option value="${site}" ${betToEdit && betToEdit.website === site ? 'selected' : ''}>${site}</option>
                                    `).join('')}
                                    <option value="new">+ Add New</option>
                                </select>
                                <input type="text" id="website" name="website" required 
                                    placeholder="e.g., DraftKings" 
                                    style="display: ${betToEdit && !websites.includes(betToEdit.website) ? 'block' : 'none'};"
                                    value="${betToEdit ? betToEdit.website : ''}">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="date">Date</label>
                            <input type="date" id="date" name="date" required value="${betToEdit ? new Date(betToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="description">Bet Description</label>
                            <textarea id="description" name="description" required placeholder="Describe your bet in detail...">${betToEdit ? betToEdit.description : ''}</textarea>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="odds">Decimal Odds</label>
                            <input type="number" id="odds" name="odds" step="0.01" min="1.01" required placeholder="1.91" value="${betToEdit ? betToEdit.odds : ''}">
                            <small class="form-hint">Standard odds</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="boosted-odds">Boosted <span class="optional-tag">(optional)</span></label>
                            <input type="number" id="boosted-odds" name="boosted-odds" step="0.01" min="1.01" placeholder="2.00" value="${betToEdit && betToEdit.boosted_odds ? betToEdit.boosted_odds : ''}">
                            <small class="form-hint">If applicable</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="amount">Amount (€)</label>
                            <input type="number" id="amount" name="amount" step="0.01" min="0.01" required placeholder="10.00" value="${betToEdit ? betToEdit.amount : ''}">
                            <small class="form-hint">Stake</small>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="outcome">Outcome</label>
                            <select id="outcome" name="outcome" required>
                                <option value="">-- Select --</option>
                                <option value="win" ${betToEdit && betToEdit.outcome === 'win' ? 'selected' : ''}>Win</option>
                                <option value="loss" ${betToEdit && betToEdit.outcome === 'loss' ? 'selected' : ''}>Loss</option>
                                <option value="pending" ${betToEdit && betToEdit.outcome === 'pending' ? 'selected' : ''}>Pending</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="note">Notes <span class="optional-tag">(optional)</span></label>
                            <textarea id="note" name="note" placeholder="Any notes or strategy thoughts...">${betToEdit && betToEdit.note ? betToEdit.note : ''}</textarea>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="reset" class="btn-secondary">Clear</button>
                    ${betToEdit ? '<button type="button" class="btn-secondary" id="cancel-edit">Cancel</button>' : ''}
                    <button type="submit" class="btn-primary">${submitButtonText}</button>
                </div>
            </form>
        </div>
    `;

  // Add form submission handler
  document.getElementById('new-bet-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveBet();
  });

  // Add cancel button handler if editing
  if (betToEdit) {
    document.getElementById('cancel-edit').addEventListener('click', () => {
      handleNavigation('bet-history');
    });
  }
}

// Function to handle website selection
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
        note: betData.note || null // Add note field
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

export { loadNewBetForm, handleWebsiteSelect, saveBet };
