// Function to load super boost strategy page
function loadSuperBoostStrategy() {
  const contentSection = document.getElementById('content');

  contentSection.innerHTML = `
        <article class="strategy-content">
            <h2>How to Profit from Super Boost Offers</h2>

            <section class="strategy-section">
                <h3>What are Super Boosts?</h3>
                <p>Super boosts are special promotions from betting sites that temporarily increase the odds on certain bets. For example, a bet that normally pays €15 for a €10 stake might be "boosted" to pay €20.</p>
                <p>These promotions can give you a real advantage when used smartly!</p>
            </section>

            <section class="strategy-section">
                <h3>Why Do Betting Sites Offer These?</h3>
                <p>Betting sites use super boosts as marketing tools to:</p>
                <ul>
                    <li>Attract new customers</li>
                    <li>Keep existing users engaged</li>
                    <li>Encourage more betting activity</li>
                </ul>
                <p>While they might lose money on the boosted bet itself, they hope you'll stick around and place more regular bets where they have the advantage.</p>
                
                <div class="strategy-highlight">
                    <p><strong>Your Opportunity:</strong> By taking advantage of these boosts and avoiding other bets, you can actually gain an edge!</p>
                </div>
            </section>

            <section class="strategy-section">
                <h3>Understanding Betting Odds</h3>
                
                <h4>Decimal Odds Explained</h4>
                <p>In Europe, odds are typically shown as decimal numbers. These tell you how much you'll get back in total for each €1 you bet.</p>
                
                <p>For example:</p>
                <ul>
                    <li><strong>Odds of 2.00:</strong> Bet €10, get €20 back (your €10 stake + €10 profit)</li>
                    <li><strong>Odds of 1.50:</strong> Bet €10, get €15 back (your €10 stake + €5 profit)</li>
                </ul>
            </section>

            <section class="strategy-section">
                <h3>Fair Odds vs. Real-World Odds</h3>
                
                <h4>What Would be Fair?</h4>
                <p>Imagine flipping a coin - there's a 50% chance of heads and 50% chance of tails.</p>
                <p>If we wanted to create fair betting odds for this coin flip:</p>
                <ul>
                    <li>For a 50% chance (0.50), the fair odds would be: 1 ÷ 0.50 = 2.00</li>
                </ul>
                
                <p>So with fair odds:</p>
                <ul>
                    <li>You bet €10 on heads at 2.00 odds</li>
                    <li>If it's heads, you get €20 back (€10 profit)</li>
                    <li>If it's tails, you lose your €10</li>
                </ul>
                
                <p>Over many bets, with fair odds, you'd break even. This is because the odds perfectly match the actual chances of winning.</p>

                <h4>How Betting Sites Make Money</h4>
                <p>Betting sites don't offer fair odds. Instead, they build in a margin (called "vig" or "juice") that ensures they make money long-term.</p>
                
                <p>For our coin flip example:</p>
                <ul>
                    <li><strong>Fair odds:</strong> 2.00 for heads and 2.00 for tails</li>
                    <li><strong>Actual betting site odds:</strong> 1.90 for heads and 1.90 for tails</li>
                </ul>
                
                <h4>Seeing the House Edge</h4>
                <p>We can convert odds to implied probability:</p>
                <div class="formula">
                    <p>Implied Probability = 1 ÷ Decimal Odds</p>
                    <p>Implied Probability = 1 ÷ 1.90 = 0.526 (52.6%)</p>
                </div>
                
                <p>So the betting site is acting as if:</p>
                <ul>
                    <li>Heads has a 52.6% chance</li>
                    <li>Tails has a 52.6% chance</li>
                    <li>Total: 105.2%</li>
                </ul>
                
                <div class="strategy-highlight">
                    <p>But wait! Probabilities should add up to 100%, not 105.2%. The extra 5.2% is the betting site's edge - their built-in profit margin.</p>
                </div>
            </section>

            <section class="strategy-section">
                <h3>Why Super Boosts Can Be Valuable</h3>
                <p>Now for the exciting part - sometimes super boosts can actually give YOU the edge instead!</p>
                
                <img src="assets/images/super-boost-example.png" alt="Example of a Super Boost offer" class="strategy-image">
                
                <h4>A Real Example</h4>
                <p>Let's use the super boost shown in the image above as our example:</p>
                <ul>
                    <li>Over 9.5 shots on target in the match: 1.50 (standard odds)</li>
                    <li>Over 9.5 shots on target in the match: 2.00 (boosted odds) - <em>Super Boost!</em></li>
                </ul>
                
                <h4>Finding the True Probability</h4>
                <p>To figure out if this is a good deal, we first need to estimate the true probability:</p>
                <ol>
                    <li>Start with the standard odds (1.50)</li>
                    <li>Remove the typical betting site margin (about 5%)</li>
                </ol>
                
                <div class="formula">
                    <p>Step 1: True Odds = Standard Odds ÷ 0.95</p>
                    <p>Step 1: True Odds = 1.50 ÷ 0.95 = 1.58</p>
                    <p>Step 2: True Probability = 1 ÷ 1.58 = 0.633 (63.3%)</p>
                </div>
                
                <p>So the true probability of seeing over 9.5 shots on target in the match is about 63.3%, according to the betting site's own odds (after removing their margin).</p>

                <h4>Is This Boost Profitable?</h4>
                <p>Now let's determine if the boost gives us an edge by comparing the expected value (EV) of the standard odds versus the boosted odds:</p>
                
                <div class="formula">
                    <p>Expected Value = (Win Probability × Total Return) - Stake</p>
                </div>
                
                <p>For a €20 stake, let's compare both scenarios:</p>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                    <div style="width: 48%;">
                        <h5>Standard Odds (1.50)</h5>
                        <div class="formula">
                            <p>Total Return = €20 × 1.50 = €30</p>
                            <p>EV = (0.633 × €30) - €20</p>
                            <p>EV = €19.00 - €20</p>
                            <p>EV = -€1.00</p>
                        </div>
                        <p><strong>Result:</strong> With standard odds, you lose €1.00 on average.</p>
                    </div>
                    <div style="width: 48%;">
                        <h5>Boosted Odds (2.00)</h5>
                        <div class="formula">
                            <p>Total Return = €20 × 2.00 = €40</p>
                            <p>EV = (0.633 × €40) - €20</p>
                            <p>EV = €25.32 - €20</p>
                            <p>EV = +€5.32</p>
                        </div>
                        <p><strong>Result:</strong> With boosted odds, you profit €5.32 on average.</p>
                    </div>
                </div>
                
                <div class="strategy-highlight">
                    <p>The comparison shows how the super boost transforms a bet with negative expected value (-€1.00) into one with positive expected value (+€5.32). This is why super boosts can be profitable opportunities!</p>
                </div>
            </section>

            <section class="strategy-section">
                <h3>Conclusion</h3>
                <p>Super boosts present an opportunity to place bets with a positive expected value (EV), meaning they are mathematically favorable over time. While sportsbooks offer these boosts as a marketing tool, disciplined bettors who focus solely on super boosts can take advantage of these temporary edges. By understanding EV and avoiding additional unfavorable bets, you can increase your profitability and make the most of super boost promotions.</p>
                
                <div class="strategy-highlight">
                    <p>Remember: The key to success is discipline - stick to betting only on super boosts with positive EV and avoid the temptation of regular bets with negative EV.</p>
                </div>
            </section>
        </article>
    `;
}

export { loadSuperBoostStrategy };
