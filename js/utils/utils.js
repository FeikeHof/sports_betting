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

export { 
    validateBetData,
    showNotification
};
