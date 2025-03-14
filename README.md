# Sports Betting Tracker

A web application for tracking sports bets, analyzing performance, and learning about profitable betting strategies.

## Features

- User authentication with Google Sign-In
- Track bets with detailed information (website, odds, amount, outcome, etc.)
- View bet history with sorting and filtering capabilities
- Dashboard with performance analytics and charts
- Strategy guide for profitable betting techniques

## Project Structure

```
sports_betting/
├── index.html               # Main HTML entry point
├── .htaccess                # Apache web server configuration
├── config.js                # App configuration (API keys, etc.)
├── config.example.js        # Example configuration template
├── .env                     # Environment variables
├── .eslintrc.js             # ESLint configuration
├── package.json             # NPM package configuration
├── css/                     # CSS styles organized by functionality
│   ├── animation.css        # Animation styles
│   ├── auth.css             # Authentication related styles
│   ├── base.css             # Base/reset styles
│   ├── components.css       # Reusable component styles
│   ├── dashboard.css        # Dashboard specific styles
│   ├── forms.css            # Form element styles
│   ├── layout.css           # Layout structure styles
│   ├── main.css             # Main stylesheet imports
│   ├── responsive.css       # Responsive design rules
│   ├── strategy.css         # Strategy page styles
│   └── tables.css           # Table and data display styles
├── js/                      # JavaScript modules
│   ├── app.js               # Main application entry point
│   ├── auth/                # Authentication modules
│   │   └── auth.js          # User authentication logic
│   ├── api/                 # API modules
│   │   ├── api.js           # API functions for data access
│   │   └── supabase.js      # Supabase client initialization
│   ├── components/          # UI components
│   │   ├── dashboard.js     # Dashboard component
│   │   ├── betHistory.js    # Bet history component
│   │   ├── newBet.js        # New bet form component
│   │   └── strategy.js      # Strategy content component
│   ├── utils/               # Utility functions
│   │   └── utils.js         # Helper functions
│   └── views/               # View controllers
│       └── router.js        # Navigation router
└── assets/                  # Static assets
    └── images/              # Image files
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `config.example.js` to `config.js` and update with your API keys
4. Copy `.env.example` to `.env` (if exists) and configure environment variables
5. Open `index.html` in a modern web browser or set up a local server

## Development

This project can be run locally using any web server. For a quick development server:

```bash
# Using npx and a simple http server
npx http-server

# Or if you have Python installed
python -m http.server
```

## Dependencies

- [Supabase JS](https://supabase.com/docs/reference/javascript/introduction) - Database and authentication
- [Chart.js](https://www.chartjs.org/) - Interactive charts and data visualization
- [Google Sign-In API](https://developers.google.com/identity/gsi/web) - User authentication

## CSS Organization

The CSS is modularly organized for maintainability:
- **base.css**: Contains reset and base styles
- **layout.css**: Defines the layout structure
- **components.css**: Styles for reusable UI components
- **forms.css**: Form element styling
- **tables.css**: Table styling for data display
- **responsive.css**: Media queries for responsive design
- **animation.css**: Animation styles
- Feature-specific stylesheets (dashboard.css, strategy.css, auth.css)

## Browser Compatibility

This application uses JavaScript modules and requires a modern browser:
- Google Chrome (version 61+)
- Firefox (version 60+)
- Safari (version 11+)
- Microsoft Edge (version 16+)

## Linting with ESLint

This project uses ESLint to maintain code quality and consistent style. To run the linter:

```bash
# Check for linting errors
npm run lint

# Fix automatically fixable issues
npm run lint:fix
```

The project follows a customized version of the Airbnb JavaScript style guide with some modifications for ease of development:

- Console statements are allowed (though they should be used sparingly)
- Import extensions are required (necessary for browser-based ES modules)
- Maximum line length is set to 120 characters
- Some rules are relaxed for CSS class names and property manipulation

### VS Code Integration

For the best development experience, install the ESLint extension for VS Code. The project includes settings to enable automatic fixing of problems when you save files. To install:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "ESLint" and install the extension by Microsoft

## License

MIT 