// Dashboard Configuration
const config = window.DASHBOARD_CONFIG || {};

// Clipboard copy function with fallback
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for HTTP and older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
}

// Show copy feedback
function showCopyFeedback(button, success = true) {
  const originalText = button.textContent;
  button.textContent = success ? "Copied!" : "Failed";
  button.style.background = success ? "var(--neon-green)" : "var(--neon-red)";

  setTimeout(() => {
    button.textContent = originalText;
    button.style.background = "transparent";
  }, 1500);
}

// Toggle API row expansion
function toggleRow(rowElement) {
  const expandSection = rowElement.querySelector(".expand-section");
  const isExpanded = rowElement.classList.contains("expanded");

  if (isExpanded) {
    rowElement.classList.remove("expanded");
    expandSection.classList.remove("show");
  } else {
    rowElement.classList.add("expanded");
    expandSection.classList.add("show");
  }
}

// Switch tabs in expanded section
function switchTab(tabName, element) {
  const expandSection = element.closest(".expand-section");
  const tabs = expandSection.querySelectorAll(".tab-btn");
  const contents = expandSection.querySelectorAll(".tab-content");

  tabs.forEach((tab) => tab.classList.remove("active"));
  contents.forEach((content) => content.classList.remove("active"));

  element.classList.add("active");
  expandSection.querySelector(`#${tabName}`).classList.add("active");
}

// Create API row HTML
function createApiRow(api, method) {
  const authRequired =
    api.headers && (api.headers.Authorization || api.headers.authorization);
  const authBadge = authRequired
    ? '<span class="auth-badge">Auth Required</span>'
    : "";
  const uniqueId = api.path.replace(/[^a-zA-Z0-9]/g, "") + method;

  // Create full URL with base URL
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${api.path}`;

  // Create sample request body
  let sampleBody = api.body || getDefaultSampleBody(api.path, method);

  // Create cURL command
  let curlCommand = `curl -X ${method} ${fullUrl}`;

  if (api.headers) {
    Object.entries(api.headers).forEach(([key, value]) => {
      curlCommand += ` -H '${key}: ${value}'`;
    });
  }

  if (
    (method === "POST" || method === "PUT") &&
    sampleBody &&
    Object.keys(sampleBody).length > 0
  ) {
    curlCommand += ` -d '${JSON.stringify(sampleBody)}'`;
  }

  return `
        <div class="api-row" onclick="toggleRow(this)">
            <div class="row-main">
                <div class="method-badge method-${method}">${method}</div>
                <div class="endpoint">${fullUrl}</div>
                <div>${authBadge}</div>
                <div>
                    <button class="copy-btn" onclick="event.stopPropagation(); copyEndpoint('${fullUrl}', this)">
                        Copy
                    </button>
                </div>
            </div>
            <div class="expand-section" onclick="event.stopPropagation()">
                <div class="section-tabs">
                    ${
                      config.enableTesting
                        ? `
                    <button class="tab-btn active" onclick="event.stopPropagation(); switchTab('test-${uniqueId}', this)">
                        🚀 Test API
                    </button>
                    `
                        : ""
                    }
                    <button class="tab-btn ${
                      !config.enableTesting ? "active" : ""
                    }" onclick="event.stopPropagation(); switchTab('payload-${uniqueId}', this)">
                        Request Body
                    </button>
                    <button class="tab-btn" onclick="event.stopPropagation(); switchTab('curl-${uniqueId}', this)">
                        cURL Command
                    </button>
                </div>
                
                ${
                  config.enableTesting
                    ? `
                <div id="test-${uniqueId}" class="tab-content active">
                    <div class="api-tester">
                        ${
                          api.path.includes(":")
                            ? `
                        <div class="test-section">
                            <h4>🔗 URL Parameters</h4>
                            <div class="url-params" id="params-${uniqueId}">
                                ${generateUrlParamInputs(api.path, uniqueId)}
                            </div>
                        </div>
                        `
                            : ""
                        }
                        
                        ${
                          method === "GET"
                            ? `
                        <div class="test-section">
                            <h4>❓ Query Parameters (Optional)</h4>
                            <div class="query-params">
                                <input type="text" placeholder="page=1&limit=10&sort=name" class="query-input" id="query-${uniqueId}" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onfocus="event.stopPropagation()">
                                <small class="param-hint">Format: key1=value1&key2=value2 (for filtering, pagination, sorting)</small>
                            </div>
                        </div>
                        `
                            : ""
                        }
                        
                        ${
                          (method === "POST" || method === "PUT") && sampleBody
                            ? `
                        <div class="test-section">
                            <h4>📝 Request Body</h4>
                            <textarea class="request-editor" id="body-${uniqueId}" placeholder="Enter JSON request body..." onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onfocus="event.stopPropagation()">${JSON.stringify(
                                sampleBody,
                                null,
                                2
                              )}</textarea>
                        </div>
                        `
                            : ""
                        }
                        
                        <div class="test-section">
                            <button class="test-btn" onclick="event.stopPropagation(); testAPI('${
                              api.path
                            }', '${method}', '${uniqueId}')">
                                🚀 Send Request
                            </button>
                        </div>
                        
                        <div class="test-section">
                            <h4>📤 Response</h4>
                            <div class="response-container" id="response-${uniqueId}" onclick="event.stopPropagation()">
                                <div class="response-placeholder">Click "Send Request" to test this API</div>
                            </div>
                        </div>
                    </div>
                </div>
                `
                    : ""
                }
                
                <div id="payload-${uniqueId}" class="tab-content ${
    !config.enableTesting ? "active" : ""
  }">
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="event.stopPropagation(); copyCodeBlock('${uniqueId}', 'payload', this)">Copy</button>
                        <pre>${
                          sampleBody
                            ? JSON.stringify(sampleBody, null, 2)
                            : "No request body required"
                        }</pre>
                    </div>
                </div>
                
                <div id="curl-${uniqueId}" class="tab-content">
                    <div class="code-block">
                        <button class="copy-code-btn" onclick="event.stopPropagation(); copyCodeBlock('${uniqueId}', 'curl', this)">Copy</button>
                        <pre>${curlCommand}</pre>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get default sample body based on route path and method
function getDefaultSampleBody(routePath, method) {
  if (method === "GET" || method === "DELETE") {
    return null;
  }

  // Smart defaults based on route path
  if (routePath.includes("register")) {
    return {
      name: "John Doe",
      email: "john@example.com",
      password: "securePassword123",
      phone: "+1234567890",
    };
  } else if (routePath.includes("login")) {
    return {
      email: "john@example.com",
      password: "securePassword123",
    };
  } else if (routePath.includes("verify")) {
    return {
      email: "john@example.com",
      otp: "123456",
    };
  } else if (routePath.includes("password")) {
    return {
      email: "john@example.com",
      password: "newSecurePassword123",
      otp: "123456",
    };
  } else if (routePath.includes("user") && method === "POST") {
    return {
      name: "Jane Smith",
      email: "jane@example.com",
      role: "user",
      phone: "+1234567890",
    };
  } else if (routePath.includes("user") && method === "PUT") {
    return {
      name: "Updated Name",
      email: "updated@example.com",
      phone: "+1987654321",
    };
  }

  return {
    field1: "value1",
    field2: "value2",
  };
}

// Generate URL parameter input fields
function generateUrlParamInputs(path, uniqueId) {
  const paramMatches = path.match(/:(\w+)/g);
  if (!paramMatches) return "";

  return paramMatches
    .map((param) => {
      const paramName = param.substring(1); // Remove the ':'
      return `
            <div class="param-input-group">
                <label class="param-label">${paramName}:</label>
                <input type="text" 
                       class="param-input" 
                       id="param-${paramName}-${uniqueId}" 
                       placeholder="Enter ${paramName}" 
                       onclick="event.stopPropagation()" 
                       onkeydown="event.stopPropagation()" 
                       onfocus="event.stopPropagation()">
            </div>
        `;
    })
    .join("");
}

// Copy endpoint function
async function copyEndpoint(fullUrl, button) {
  const success = await copyToClipboard(fullUrl);
  showCopyFeedback(button, success);
}

// Copy code block content
async function copyCodeBlock(uniqueId, type, button) {
  let textToCopy = "";

  if (type === "payload") {
    const preElement = button.nextElementSibling;
    textToCopy = preElement.textContent;
  } else if (type === "curl") {
    const preElement = button.nextElementSibling;
    textToCopy = preElement.textContent;
  }

  const success = await copyToClipboard(textToCopy);
  showCopyFeedback(button, success);
}

// Group APIs by category
function groupAPIsByCategory(apis) {
  const groups = {};

  apis.forEach((api) => {
    let category = "Other APIs";
    let categoryIcon = "📋";

    if (api.path.includes("/auth/")) {
      category = "Authentication APIs";
      categoryIcon = "🔐";
    } else if (api.path.includes("/user/")) {
      category = "User Management APIs";
      categoryIcon = "👥";
    } else if (api.path.includes("/admin/")) {
      category = "Admin APIs";
      categoryIcon = "⚙️";
    } else if (api.path.includes("/api/")) {
      // Extract the first part after /api/
      const pathParts = api.path.split("/");
      const apiIndex = pathParts.indexOf("api");
      if (apiIndex !== -1 && pathParts[apiIndex + 1]) {
        const section = pathParts[apiIndex + 1];
        if (section === "auth") {
          category = "Authentication APIs";
          categoryIcon = "🔐";
        } else if (section === "user") {
          category = "User Management APIs";
          categoryIcon = "👥";
        } else {
          category = `${
            section.charAt(0).toUpperCase() + section.slice(1)
          } APIs`;
          categoryIcon = "📋";
        }
      }
    }

    if (!groups[category]) {
      groups[category] = {
        icon: categoryIcon,
        apis: [],
      };
    }

    groups[category].apis.push(api);
  });

  return groups;
}

// Create category section header
function createCategoryHeader(categoryName, categoryIcon, count) {
  return `
        <div class="category-header">
            <div class="category-info">
                <span class="category-icon">${categoryIcon}</span>
                <span class="category-name">${categoryName}</span>
                <span class="category-count">${count} endpoint${
    count !== 1 ? "s" : ""
  }</span>
            </div>
        </div>
    `;
}

// Test API function
async function testAPI(path, method, uniqueId) {
  if (!config.enableTesting) {
    alert("API testing is disabled");
    return;
  }

  const button = document.querySelector(
    `button[onclick*="testAPI('${path}', '${method}', '${uniqueId}')"]`
  );
  const responseContainer = document.getElementById(`response-${uniqueId}`);

  // Get global token from localStorage
  const authToken = localStorage.getItem("apiDashboardToken") || "";

  // Build the actual URL with parameters
  const baseUrl = window.location.origin;
  let actualUrl = path.startsWith("http") ? path : `${baseUrl}${path}`;

  // Replace URL parameters
  const paramMatches = path.match(/:(\w+)/g);
  if (paramMatches) {
    for (const param of paramMatches) {
      const paramName = param.substring(1);
      const paramInput = document.getElementById(
        `param-${paramName}-${uniqueId}`
      );
      const paramValue = paramInput ? paramInput.value.trim() : "";

      if (!paramValue) {
        showResponse(
          responseContainer,
          {
            status: "Error",
            statusCode: 400,
            error: `Missing required parameter: ${paramName}`,
            details: `Please provide a value for ${paramName}`,
          },
          0,
          "error"
        );
        return;
      }

      actualUrl = actualUrl.replace(param, paramValue);
    }
  }

  // Add query parameters
  const queryInput = document.getElementById(`query-${uniqueId}`);
  const queryString = queryInput ? queryInput.value.trim() : "";
  if (queryString) {
    actualUrl += (actualUrl.includes("?") ? "&" : "?") + queryString;
  }

  // Get request body for POST/PUT requests
  let requestBody = null;
  if (method === "POST" || method === "PUT") {
    const bodyEditor = document.getElementById(`body-${uniqueId}`);
    const bodyText = bodyEditor ? bodyEditor.value.trim() : "";

    if (bodyText) {
      try {
        requestBody = JSON.parse(bodyText);
      } catch (error) {
        showResponse(
          responseContainer,
          {
            status: "Error",
            statusCode: 400,
            error: "Invalid JSON in request body",
            details: error.message,
          },
          0,
          "error"
        );
        return;
      }
    }
  }

  // Show loading state
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner"></span>Sending...';
  showResponse(responseContainer, null, 0, "loading");

  const startTime = Date.now();

  try {
    // Prepare request options
    const requestOptions = {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Add authorization header if token provided
    if (authToken) {
      requestOptions.headers["Authorization"] = authToken.startsWith("Bearer ")
        ? authToken
        : `Bearer ${authToken}`;
    }

    // Add request body for POST/PUT
    if (requestBody) {
      requestOptions.body = JSON.stringify(requestBody);
    }

    // Make the API request
    console.log(`🚀 Testing API: ${method} ${actualUrl}`);
    const response = await fetch(actualUrl, requestOptions);
    const responseTime = Date.now() - startTime;

    // Parse response
    let responseData;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Determine status type
    let statusType = "success";
    if (response.status >= 400) {
      statusType = "error";
    } else if (response.status >= 300) {
      statusType = "info";
    }

    // Show response
    showResponse(
      responseContainer,
      {
        status: response.statusText || "OK",
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData,
      },
      responseTime,
      statusType
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;

    showResponse(
      responseContainer,
      {
        status: "Network Error",
        statusCode: 0,
        error: error.message,
        details: "Failed to connect to the server",
      },
      responseTime,
      "error"
    );
  } finally {
    // Reset button state
    button.disabled = false;
    button.innerHTML = "🚀 Send Request";
  }
}

// Show API response in the container
function showResponse(container, response, responseTime, type) {
  if (type === "loading") {
    container.innerHTML = `
            <div class="response-placeholder">
                <span class="loading-spinner"></span>
                Sending request...
            </div>
        `;
    return;
  }

  const statusClass = `status-${type}`;
  const statusIcon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";

  container.innerHTML = `
        <div class="response-status ${statusClass}">
            <span>${statusIcon} ${response.statusCode} ${response.status}</span>
            <span class="response-time">${responseTime}ms</span>
        </div>
        <div class="response-content">
            <div class="response-body">${JSON.stringify(
              response.body || response,
              null,
              2
            )}</div>
        </div>
    `;

  // Auto-detect and save token from successful login responses
  if (type === "success" && response.body && config.enableAuth) {
    autoSaveTokenFromResponse(response.body);
  }
}

// Update statistics
function updateStats(apis) {
  const stats = {
    total: apis.length,
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
  };

  apis.forEach((api) => {
    if (api.method && stats.hasOwnProperty(api.method)) {
      stats[api.method]++;
    }
  });

  document.getElementById("total-apis").textContent = stats.total;
  document.getElementById("get-count").textContent = stats.GET;
  document.getElementById("post-count").textContent = stats.POST;
  document.getElementById("put-count").textContent = stats.PUT;
  document.getElementById("delete-count").textContent = stats.DELETE;
}

// Load APIs from backend
async function loadApis() {
  try {
    const response = await fetch(`${config.basePath}/api/routes`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const apiList = document.getElementById("api-list");

    if (!data.apis || data.apis.length === 0) {
      apiList.innerHTML = '<div class="error">No APIs found</div>';
      return;
    }

    // Clear loading message
    apiList.innerHTML = "";

    // Group APIs by category
    const groupedAPIs = groupAPIsByCategory(data.apis);

    // Define the order of categories
    const categoryOrder = [
      "Authentication APIs",
      "User Management APIs",
      "Admin APIs",
      "Other APIs",
    ];

    // Render each category
    categoryOrder.forEach((categoryName) => {
      if (groupedAPIs[categoryName]) {
        const group = groupedAPIs[categoryName];

        // Add category header
        apiList.innerHTML += createCategoryHeader(
          categoryName,
          group.icon,
          group.apis.length
        );

        // Add APIs in this category
        group.apis.forEach((api) => {
          apiList.innerHTML += createApiRow(api, api.method);
        });
      }
    });

    // Add any remaining categories not in the predefined order
    Object.keys(groupedAPIs).forEach((categoryName) => {
      if (!categoryOrder.includes(categoryName)) {
        const group = groupedAPIs[categoryName];

        apiList.innerHTML += createCategoryHeader(
          categoryName,
          group.icon,
          group.apis.length
        );

        group.apis.forEach((api) => {
          apiList.innerHTML += createApiRow(api, api.method);
        });
      }
    });

    // Update statistics
    updateStats(data.apis);
  } catch (error) {
    console.error("Failed to load APIs:", error);
    document.getElementById(
      "api-list"
    ).innerHTML = `<div class="error">Failed to load APIs: ${error.message}</div>`;
  }
}

// Global Token Management Functions
function saveGlobalToken() {
  if (!config.enableAuth) {
    alert("Authentication is disabled");
    return;
  }

  const tokenInput = document.getElementById("global-token");
  const token = tokenInput.value.trim();

  if (!token) {
    alert("Please enter a token first");
    return;
  }

  // Save to localStorage
  localStorage.setItem("apiDashboardToken", token);

  // Update status
  updateTokenStatus(token);
  updateTokenStatusMini(token);

  // Clear the input
  tokenInput.value = "";

  console.log("✅ Token saved globally");
}

function clearGlobalToken() {
  if (!config.enableAuth) {
    alert("Authentication is disabled");
    return;
  }

  // Remove from localStorage
  localStorage.removeItem("apiDashboardToken");

  // Update status
  updateTokenStatus("");
  updateTokenStatusMini("");

  // Clear the input
  document.getElementById("global-token").value = "";

  console.log("🗑️ Global token cleared");
}

function copySavedToken() {
  if (!config.enableAuth) {
    alert("Authentication is disabled");
    return;
  }

  const savedToken = localStorage.getItem("apiDashboardToken");
  if (!savedToken) {
    alert("No token saved to copy");
    return;
  }

  copyToClipboard(savedToken).then((success) => {
    if (success) {
      showTokenNotification("📋 Token copied to clipboard!");
    } else {
      alert("Failed to copy token");
    }
  });
}

function loadGlobalToken() {
  if (!config.enableAuth) {
    return;
  }

  const savedToken = localStorage.getItem("apiDashboardToken");
  if (savedToken) {
    updateTokenStatus(savedToken);
    updateTokenStatusMini(savedToken);
  } else {
    updateTokenStatus("");
    updateTokenStatusMini("");
  }
}

function toggleTokenManager() {
  if (!config.enableAuth) {
    return;
  }

  const tokenManager = document.getElementById("token-manager");
  const isExpanded = tokenManager.classList.contains("expanded");

  if (isExpanded) {
    tokenManager.classList.remove("expanded");
    tokenManager.classList.add("collapsed");
  } else {
    tokenManager.classList.remove("collapsed");
    tokenManager.classList.add("expanded");
  }
}

function updateTokenStatusMini(token) {
  const statusMini = document.getElementById("token-status-mini");
  if (!statusMini) return;

  const indicator = statusMini.querySelector(".status-indicator");
  const textMini = statusMini.querySelector(".status-text-mini");

  if (token) {
    statusMini.classList.add("has-token");
    indicator.textContent = "✅";
    textMini.textContent = "Token saved";
  } else {
    statusMini.classList.remove("has-token");
    indicator.textContent = "❌";
    textMini.textContent = "No token";
  }
}

function updateTokenStatus(token) {
  const statusElement = document.getElementById("token-status");
  if (!statusElement) return;

  const statusText = statusElement.querySelector(".status-text");

  if (token) {
    statusElement.className = "token-status has-token";
    const maskedToken =
      token.length > 20
        ? token.substring(0, 10) + "..." + token.substring(token.length - 10)
        : token.substring(0, 10) + "...";
    statusText.textContent = `✅ Token saved: ${maskedToken}`;
  } else {
    statusElement.className = "token-status no-token";
    statusText.textContent = "❌ No token saved";
  }
}

// Auto-detect and save token from login responses
function autoSaveTokenFromResponse(responseData) {
  if (!config.enableAuth || !responseData || typeof responseData !== "object") {
    return false;
  }

  // Common token field names
  const tokenFields = [
    "token",
    "accessToken",
    "access_token",
    "authToken",
    "jwt",
  ];

  for (const field of tokenFields) {
    if (responseData[field]) {
      const token = responseData[field];
      localStorage.setItem("apiDashboardToken", token);
      updateTokenStatus(token);
      updateTokenStatusMini(token);

      // Show notification
      showTokenNotification("🎉 Token auto-saved from login response!");
      console.log("🎉 Auto-saved token from response:", field);
      return true;
    }
  }
  return false;
}

function showTokenNotification(message) {
  // Create notification element
  const notification = document.createElement("div");
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--neon-green);
        color: var(--bg-primary);
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 0 20px var(--neon-green);
        animation: slideIn 0.3s ease;
    `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", () => {
  loadApis();

  if (config.enableAuth) {
    loadGlobalToken();
  } else {
    // Hide token manager if auth is disabled
    const tokenManager = document.getElementById("token-manager");
    if (tokenManager) {
      tokenManager.style.display = "none";
    }
  }
});

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);
