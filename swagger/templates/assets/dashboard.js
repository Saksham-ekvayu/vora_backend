// Dashboard Configuration
const config = window.DASHBOARD_CONFIG || {};

// Theme Management
function initializeTheme() {
  // Check for saved theme preference or default to config theme
  const savedTheme =
    localStorage.getItem("dashboardTheme") || config.theme || "dark";
  setTheme(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("dashboardTheme", theme);

  // Update theme toggle icon
  const themeIcon = document.querySelector(".theme-icon");
  if (themeIcon) {
    themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  console.log(`🎨 Theme switched to: ${theme}`);
}

// Clipboard copy function with fallback
async function copyToClipboard(text) {
  try {
    // Method 1: Modern Clipboard API (HTTPS/localhost only)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Method 2: Fallback using document.execCommand (works on HTTP)
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.setAttribute("readonly", "");
    textArea.setAttribute("contenteditable", "true");

    document.body.appendChild(textArea);

    // For iOS Safari
    if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
      const editable = textArea.contentEditable;
      const readOnly = textArea.readOnly;
      textArea.contentEditable = "true";
      textArea.readOnly = false;
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      textArea.setSelectionRange(0, 999999);
      textArea.contentEditable = editable;
      textArea.readOnly = readOnly;
    } else {
      textArea.focus();
      textArea.select();
    }

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error("execCommand failed");
    }

    return true;
  } catch (err) {
    console.error("Failed to copy:", err);

    // Method 3: Last resort - show text in prompt for manual copy
    try {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent
        );

      if (isMobile) {
        // On mobile, show a more user-friendly message
        alert(
          `Copy this text:\n\n${text.substring(0, 200)}${
            text.length > 200 ? "..." : ""
          }`
        );
      } else {
        // On desktop, use prompt which allows text selection
        prompt("Copy this text (Ctrl+C):", text);
      }
      return true;
    } catch (promptErr) {
      console.error("Prompt fallback failed:", promptErr);
      return false;
    }
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

    // Restore saved form data when expanding
    const uniqueId = expandSection
      .querySelector('[id*="-"]')
      ?.id?.split("-")
      .pop();
    if (uniqueId) {
      setTimeout(() => restoreFormFields(uniqueId), 100); // Small delay to ensure DOM is ready
    }
  }

  // Save scroll position after expansion/collapse
  setTimeout(() => {
    saveScrollPosition();
    saveExpandedSections();
  }, 100);
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

// Form Data Persistence Functions
function saveFormData(uniqueId, data) {
  try {
    const formDataKey = `swagger_form_${uniqueId}`;
    localStorage.setItem(formDataKey, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving form data:", error);
  }
}

function loadFormData(uniqueId) {
  try {
    const formDataKey = `swagger_form_${uniqueId}`;
    const savedData = localStorage.getItem(formDataKey);
    return savedData ? JSON.parse(savedData) : null;
  } catch (error) {
    console.error("Error loading form data:", error);
    return null;
  }
}

function clearFormData(uniqueId) {
  try {
    const formDataKey = `swagger_form_${uniqueId}`;
    localStorage.removeItem(formDataKey);
  } catch (error) {
    console.error("Error clearing form data:", error);
  }
}

function saveFieldValue(uniqueId, fieldName, value) {
  const savedData = loadFormData(uniqueId) || {};
  savedData[fieldName] = value;
  saveFormData(uniqueId, savedData);
}

// Scroll Position Persistence Functions
function saveScrollPosition() {
  try {
    const scrollPosition = {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop,
      timestamp: Date.now(),
    };
    localStorage.setItem(
      "swagger_scroll_position",
      JSON.stringify(scrollPosition)
    );
  } catch (error) {
    console.error("Error saving scroll position:", error);
  }
}

function restoreScrollPosition() {
  try {
    const savedPosition = localStorage.getItem("swagger_scroll_position");
    if (!savedPosition) return;

    const position = JSON.parse(savedPosition);

    // Only restore if saved within last 5 minutes (to avoid old positions)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (position.timestamp < fiveMinutesAgo) {
      localStorage.removeItem("swagger_scroll_position");
      return;
    }

    // Restore scroll position after a short delay to ensure page is loaded
    setTimeout(() => {
      window.scrollTo(position.x, position.y);
      console.log(`📍 Restored scroll position: ${position.x}, ${position.y}`);
    }, 100);
  } catch (error) {
    console.error("Error restoring scroll position:", error);
  }
}

function initScrollPersistence() {
  // Save scroll position periodically while scrolling
  let scrollTimeout;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(saveScrollPosition, 150); // Debounce scroll saving
  });

  // Save scroll position before page unload
  window.addEventListener("beforeunload", () => {
    saveScrollPosition();
    saveExpandedSections();
  });

  // Save scroll position when visibility changes (tab switching)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveScrollPosition();
      saveExpandedSections();
    }
  });
}

// Expanded Sections Persistence
function saveExpandedSections() {
  try {
    const expandedSections = [];
    const expandedRows = document.querySelectorAll(".api-row.expanded");

    expandedRows.forEach((row) => {
      const endpoint = row.querySelector(".endpoint")?.textContent;
      const method = row.querySelector(".method-badge")?.textContent;
      if (endpoint && method) {
        expandedSections.push({ endpoint, method });
      }
    });

    localStorage.setItem(
      "swagger_expanded_sections",
      JSON.stringify({
        sections: expandedSections,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error("Error saving expanded sections:", error);
  }
}

function restoreExpandedSections() {
  try {
    const savedData = localStorage.getItem("swagger_expanded_sections");
    if (!savedData) return;

    const data = JSON.parse(savedData);

    // Only restore if saved within last 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (data.timestamp < tenMinutesAgo) {
      localStorage.removeItem("swagger_expanded_sections");
      return;
    }

    // Restore expanded sections after APIs are loaded
    setTimeout(() => {
      data.sections.forEach(({ endpoint, method }) => {
        const rows = document.querySelectorAll(".api-row");
        rows.forEach((row) => {
          const rowEndpoint = row.querySelector(".endpoint")?.textContent;
          const rowMethod = row.querySelector(".method-badge")?.textContent;

          if (rowEndpoint === endpoint && rowMethod === method) {
            const expandSection = row.querySelector(".expand-section");
            if (expandSection && !row.classList.contains("expanded")) {
              row.classList.add("expanded");
              expandSection.classList.add("show");

              // Restore form data for this section
              const uniqueId = expandSection
                .querySelector('[id*="-"]')
                ?.id?.split("-")
                .pop();
              if (uniqueId) {
                setTimeout(() => restoreFormFields(uniqueId), 100);
              }
            }
          }
        });
      });

      console.log(`📂 Restored ${data.sections.length} expanded sections`);
    }, 300);
  } catch (error) {
    console.error("Error restoring expanded sections:", error);
  }
}

function restoreFormFields(uniqueId) {
  const savedData = loadFormData(uniqueId);
  if (!savedData) return;

  // Restore URL parameters
  Object.keys(savedData).forEach((fieldName) => {
    if (fieldName.startsWith("param-")) {
      const paramInput = document.getElementById(`${fieldName}-${uniqueId}`);
      if (paramInput && savedData[fieldName]) {
        paramInput.value = savedData[fieldName];
      }
    }
  });

  // Restore query parameters
  const queryInput = document.getElementById(`query-${uniqueId}`);
  if (queryInput && savedData.query) {
    queryInput.value = savedData.query;
  }

  // Restore request body
  const bodyEditor = document.getElementById(`body-${uniqueId}`);
  if (bodyEditor && savedData.body) {
    bodyEditor.value = savedData.body;
  }

  // Restore form fields for file upload APIs
  Object.keys(savedData).forEach((fieldName) => {
    if (fieldName.startsWith("field-")) {
      const fieldInput = document.getElementById(`${fieldName}-${uniqueId}`);
      if (fieldInput && savedData[fieldName]) {
        fieldInput.value = savedData[fieldName];
      }
    }
  });
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
                          method === "GET" && shouldShowQueryParams(api.path)
                            ? `
                        <div class="test-section">
                            <h4>❓ Query Parameters (Optional)</h4>
                            <div class="query-params">
                                <input type="text" placeholder="page=1&limit=10&sort=name" class="query-input" id="query-${uniqueId}" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onfocus="event.stopPropagation()" oninput="saveFieldValue('${uniqueId}', 'query', this.value)">
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
                            ${
                              api.hasFileUpload
                                ? `
                            <div class="file-upload-section">
                                <label class="file-upload-label">
                                    📎 Select File:
                                    <input type="file" class="file-input" id="file-${uniqueId}" onclick="event.stopPropagation()" onchange="event.stopPropagation(); handleFileSelect(this, '${uniqueId}')">
                                </label>
                                <div class="file-info" id="file-info-${uniqueId}">No file selected</div>
                            </div>
                            <div class="form-fields">
                                ${generateFormFields(sampleBody, uniqueId)}
                            </div>
                            `
                                : `
                            <textarea class="request-editor" id="body-${uniqueId}" placeholder="Enter JSON request body..." onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onfocus="event.stopPropagation()" oninput="saveFieldValue('${uniqueId}', 'body', this.value)">${JSON.stringify(
                                    sampleBody,
                                    null,
                                    2
                                  )}</textarea>
                            `
                            }
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

// Check if GET API should show query parameters (for list APIs, not single item APIs)
function shouldShowQueryParams(path) {
  // Don't show query params if path has ID parameter (single item API)
  if (path.includes("/:id") || path.includes(":id")) {
    return false;
  }

  // Don't show query params for specific single-item endpoints
  const singleItemPatterns = [
    "/profile",
    "/me",
    "/current",
    "/download",
    "/export",
    "/import",
  ];

  const pathLower = path.toLowerCase();
  if (singleItemPatterns.some((pattern) => pathLower.includes(pattern))) {
    return false;
  }

  // Show query params for list/collection endpoints
  const listPatterns = [
    "/all",
    "/list",
    "/search",
    "users",
    "documents",
    "files",
    "items",
    "data",
  ];

  // If path ends with a collection name (plural), likely a list API
  const pathParts = path
    .split("/")
    .filter((part) => part && !part.startsWith(":"));
  const lastPart = pathParts[pathParts.length - 1];

  if (lastPart) {
    // Check if it's a plural noun (ends with 's') or matches list patterns
    if (
      lastPart.endsWith("s") ||
      listPatterns.some((pattern) => lastPart.includes(pattern))
    ) {
      return true;
    }
  }

  // Check if any part of path indicates it's a list API
  if (listPatterns.some((pattern) => pathLower.includes(pattern))) {
    return true;
  }

  // Default: if no ID parameter and looks like a collection, show query params
  return !path.includes(":") && pathParts.length >= 2;
}

// Handle file selection
function handleFileSelect(input, uniqueId) {
  const fileInfo = document.getElementById(`file-info-${uniqueId}`);

  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    const fileSize = (file.size / 1024 / 1024).toFixed(2); // Convert to MB
    fileInfo.innerHTML = `
      <strong>📄 ${file.name}</strong><br>
      <small>Size: ${fileSize} MB | Type: ${file.type || "Unknown"}</small>
    `;
    fileInfo.style.color = "var(--neon-green)";
    fileInfo.style.borderColor = "var(--neon-green)";
  } else {
    fileInfo.innerHTML = "No file selected";
    fileInfo.style.color = "var(--text-muted)";
    fileInfo.style.borderColor = "var(--border)";
  }
}

// Get file field name based on path
function getFileFieldName(path) {
  const pathLower = path.toLowerCase();

  if (pathLower.includes("document")) return "document";
  if (pathLower.includes("image") || pathLower.includes("photo"))
    return "image";
  if (pathLower.includes("file")) return "file";
  if (pathLower.includes("attachment")) return "attachment";
  if (pathLower.includes("media")) return "media";

  return "file"; // default
}

// Generate form fields for file upload APIs
function generateFormFields(sampleBody, uniqueId) {
  if (!sampleBody || typeof sampleBody !== "object") {
    return "";
  }

  let fieldsHtml = "";
  Object.entries(sampleBody).forEach(([key, value]) => {
    // Skip file fields as they are handled separately
    if (
      key.toLowerCase().includes("file") ||
      key === "document" ||
      key === "image"
    ) {
      return;
    }

    const isOptional =
      typeof value === "string" && value.includes("(optional)");
    const placeholder = isOptional ? `${key} (optional)` : key;
    const fieldValue = isOptional
      ? ""
      : typeof value === "string"
      ? value
      : JSON.stringify(value);

    fieldsHtml += `
      <div class="form-field">
        <label class="field-label">${key}${
      isOptional ? " (optional)" : ""
    }:</label>
        <input type="text" class="field-input" id="field-${key}-${uniqueId}" 
               placeholder="${placeholder}" value="${fieldValue}"
               onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" onfocus="event.stopPropagation()" oninput="saveFieldValue('${uniqueId}', 'field-${key}', this.value)">
      </div>
    `;
  });

  return fieldsHtml;
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
                       onfocus="event.stopPropagation()"
                       oninput="saveFieldValue('${uniqueId}', 'param-${paramName}', this.value)">
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

// Copy response content
async function copyResponse(responseId, button) {
  const responseElement = document.getElementById(responseId);
  if (!responseElement) {
    console.error("Response element not found:", responseId);
    showCopyFeedback(button, false);
    return;
  }

  const responseText = responseElement.textContent;
  const success = await copyToClipboard(responseText);
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
  let isFileUpload = false;

  if (method === "POST" || method === "PUT") {
    // Check if this is a file upload API
    const fileInput = document.getElementById(`file-${uniqueId}`);

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      // This is a file upload request
      isFileUpload = true;
      requestBody = new FormData();

      // Add the file
      requestBody.append(getFileFieldName(path), fileInput.files[0]);

      // Add other form fields
      const formFields = document.querySelectorAll(
        `[id^="field-"][id$="-${uniqueId}"]`
      );
      formFields.forEach((field) => {
        const fieldName = field.id
          .replace(`field-`, "")
          .replace(`-${uniqueId}`, "");
        const fieldValue = field.value.trim();
        if (fieldValue) {
          requestBody.append(fieldName, fieldValue);
        }
      });
    } else {
      // Regular JSON request
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
      headers: {},
    };

    // Set content type based on request type
    if (!isFileUpload) {
      requestOptions.headers["Content-Type"] = "application/json";
    }
    // For file uploads, don't set Content-Type - let browser set it with boundary

    // Add authorization header if token provided
    if (authToken) {
      requestOptions.headers["Authorization"] = authToken.startsWith("Bearer ")
        ? authToken
        : `Bearer ${authToken}`;
    }

    // Add request body for POST/PUT
    if (requestBody) {
      if (isFileUpload) {
        requestOptions.body = requestBody; // FormData object
      } else {
        requestOptions.body = JSON.stringify(requestBody); // JSON string
      }
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
  const responseText = JSON.stringify(response.body || response, null, 2);

  // Generate unique ID for this response
  const responseId = `response_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  container.innerHTML = `
        <div class="response-status ${statusClass}">
            <div class="status-info">
                <span>${statusIcon} ${response.statusCode} ${response.status}</span>
                <span class="response-time">${responseTime}ms</span>
            </div>
            <button class="copy-response-btn" onclick="copyResponse('${responseId}', this)" title="Copy response">
                📋 Copy
            </button>
        </div>
        <div class="response-content">
            <div class="response-body" id="${responseId}">${responseText}</div>
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

    // Restore expanded sections and scroll position after content is loaded
    setTimeout(() => {
      restoreExpandedSections();
      restoreScrollPosition();
    }, 200);
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
  // Initialize theme first
  initializeTheme();

  // Initialize scroll position persistence
  initScrollPersistence();

  // Restore scroll position from previous session
  restoreScrollPosition();

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
