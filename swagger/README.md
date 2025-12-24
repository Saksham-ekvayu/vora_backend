# Swagger Express Dashboard

A beautiful, interactive API documentation and testing dashboard for Express.js applications. This package provides an elegant, cyberpunk-themed interface for documenting and testing your REST APIs with zero configuration required.

1.  <img width="1901" height="909" alt="image" src="https://github.com/user-attachments/assets/ad4e2e89-ee3e-43eb-ba89-e3d1ca4ade6e" />

2.  <img width="1884" height="885" alt="image" src="https://github.com/user-attachments/assets/99c2734d-faf7-4fb6-90d9-77852d7c38c8" />

## ✨ Features

- 🎨 **Beautiful UI**: Cyberpunk-themed dark interface with neon accents
- 🚀 **Interactive Testing**: Test APIs directly from the dashboard
- 🔍 **Auto-Discovery**: Automatically detects routes and request schemas
- 🔐 **Authentication Support**: Built-in token management
- 📱 **Responsive Design**: Works on desktop and mobile
- 🎯 **Zero Configuration**: Works out of the box
- 📊 **API Statistics**: Visual overview of your API endpoints
- 🔄 **Real-time Testing**: Live API testing with response visualization
- 📋 **Copy to Clipboard**: Easy copying of URLs and cURL commands
- 🏷️ **Smart Categorization**: Automatically groups APIs by functionality

## 📦 Installation

```bash
- GitHub: (https://github.com/Saksham-Kamboj/swagger-express-dashboard.git)
```

## 🚀 Quick Start

### Basic Usage

```javascript
const express = require("express");
const SwaggerExpressDashboard = require("./swagger-express-dashboard");

const app = express();

// Initialize the dashboard
const dashboard = new SwaggerExpressDashboard({
  title: "My API Documentation",
  description: "Interactive API Documentation and Testing Dashboard",
  version: "1.0.0",
});

// Initialize dashboard middleware
dashboard.init(app);

// Your existing routes
app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

app.post("/api/users", (req, res) => {
  res.json({ message: "User created" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("API Dashboard: http://localhost:3000/api-docs");
});
```

### Advanced Usage with Route Registration

```javascript
const express = require("express");
const SwaggerExpressDashboard = require("./swagger-express-dashboard");

const app = express();
const dashboard = new SwaggerExpressDashboard({
  title: "Advanced API Dashboard",
  description: "Complete API documentation with authentication",
  version: "2.0.0",
  basePath: "/docs", // Custom dashboard path
  enableAuth: true,
  enableTesting: true,
  controllersPath: "./src/controllers", // Path to your controllers for auto-detection
});

// Create routers
const authRouter = express.Router();
const userRouter = express.Router();

// Define routes
authRouter.post("/login", (req, res) => {
  // Login logic
  res.json({ token: "jwt-token-here" });
});

authRouter.post("/register", (req, res) => {
  // Registration logic
  res.json({ message: "User registered" });
});

userRouter.get("/profile", (req, res) => {
  // Get profile logic
  res.json({ user: {} });
});

userRouter.put("/profile", (req, res) => {
  // Update profile logic
  res.json({ message: "Profile updated" });
});

// Register routes with Express
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

// Register routes with dashboard for better documentation
dashboard.registerRoutes("/api/auth", authRouter);
dashboard.registerRoutes("/api/user", userRouter);

// Initialize dashboard
dashboard.init(app);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("API Dashboard: http://localhost:3000/docs"); // Custom path
});
```

## ⚙️ Configuration Options

```javascript
const dashboard = new SwaggerExpressDashboard({
  // Basic Configuration
  title: "My API Documentation", // Dashboard title
  description: "API Documentation", // Dashboard description
  version: "1.0.0", // API version
  basePath: "/api-docs", // Dashboard URL path

  // Feature Toggles
  enableTesting: true, // Enable/disable API testing
  enableAuth: true, // Enable/disable authentication features

  // Auto-detection
  autoDetectControllers: true, // Auto-detect request schemas
  controllersPath: "./src/controllers", // Path to controller files

  // Theming
  theme: "dark", // 'dark', 'light', or 'auto'
  customCSS: "", // Custom CSS styles

  // Authentication
  auth: {
    type: "bearer", // Authentication type
    tokenField: "token", // Token field name in responses
  },
});
```

## 📁 Project Structure Requirements

For optimal auto-detection, organize your project like this:

```
your-project/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   └── product.controller.js
│   └── routes/
│       ├── auth.routes.js
│       ├── user.routes.js
│       └── product.routes.js
├── package.json
└── index.js
```

### Controller File Example

```javascript
// src/controllers/auth.controller.js
const login = async (req, res) => {
  const { email, password } = req.body; // Auto-detected fields

  // Login logic here

  res.json({
    token: "jwt-token",
    user: { id: 1, email },
  });
};

const register = async (req, res) => {
  const { name, email, password, phone } = req.body; // Auto-detected fields

  // Registration logic here

  res.json({
    message: "User registered successfully",
    user: { id: 1, name, email },
  });
};

module.exports = { login, register };
```

## 🎨 Customization

### Custom Themes

```javascript
const dashboard = new SwaggerExpressDashboard({
  theme: "light", // or 'dark', 'auto'
  customCSS: `
    :root {
      --neon-green: #00ff00;
      --neon-blue: #0080ff;
    }
    .title {
      color: var(--neon-green);
    }
  `,
});
```

### Custom Route Documentation

```javascript
// Add custom documentation for specific routes
dashboard.addRouteDoc("/api/users/:id", "GET", {
  description: "Get user by ID",
  parameters: {
    id: "User ID (required)",
  },
  responses: {
    200: "User object",
    404: "User not found",
  },
});
```

## 🔐 Authentication

The dashboard supports automatic token management:

1. **Auto-detection**: Automatically saves tokens from login responses
2. **Manual entry**: Users can manually enter tokens
3. **Persistent storage**: Tokens are saved in localStorage
4. **Auto-injection**: Tokens are automatically added to API requests

### Supported Token Fields

The dashboard automatically detects tokens from these response fields:

- `token`
- `accessToken`
- `access_token`
- `authToken`
- `jwt`

## 📊 API Categories

APIs are automatically categorized based on their paths:

- 🔐 **Authentication APIs**: `/auth/` routes
- 👥 **User Management APIs**: `/user/` routes
- ⚙️ **Admin APIs**: `/admin/` routes
- 📋 **Other APIs**: All other routes

## 🛠️ API Methods

### Dashboard Class Methods

```javascript
const dashboard = new SwaggerExpressDashboard(options);

// Initialize dashboard
dashboard.init(app);

// Register routes for better documentation
dashboard.registerRoutes("/api/auth", authRouter);

// Add custom route documentation
dashboard.addRouteDoc("/api/users/:id", "GET", {
  description: "Get user by ID",
  // ... more documentation
});

// Set global authentication configuration
dashboard.setAuth({
  type: "bearer",
  tokenField: "token",
});
```

## 🌐 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 📱 Mobile Support

The dashboard is fully responsive and works on:

- iOS Safari
- Chrome Mobile
- Firefox Mobile
- Samsung Internet

## 🔧 Troubleshooting

### Common Issues

1. **Routes not appearing**: Make sure to call `dashboard.registerRoutes()` for each router
2. **Auto-detection not working**: Check that `controllersPath` points to the correct directory
3. **Styling issues**: Ensure no CSS conflicts with existing styles
4. **API testing fails**: Check CORS settings and authentication tokens

### Debug Mode

```javascript
const dashboard = new SwaggerExpressDashboard({
  debug: true, // Enable debug logging
});
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

- GitHub Issues: [Report bugs or request features](https://github.com/yourusername/swagger-express-dashboard/issues)
- Documentation: [Full documentation](https://github.com/yourusername/swagger-express-dashboard#readme)

## 🎯 Roadmap

- [ ] Custom themes

---

Made with ❤️ for the Express.js community
