const fs = require("fs");
const path = require("path");

class DashboardGenerator {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Generate the complete HTML dashboard
   * @returns {string} HTML content
   */
  generateHTML() {
    const templatePath = path.join(__dirname, "../templates/dashboard.html");
    let template = fs.readFileSync(templatePath, "utf8");

    // Replace template variables
    template = template.replace(/{{TITLE}}/g, this.options.title);
    template = template.replace(/{{DESCRIPTION}}/g, this.options.description);
    template = template.replace(/{{VERSION}}/g, this.options.version);
    template = template.replace(/{{BASE_PATH}}/g, this.options.basePath);
    template = template.replace(
      /{{CUSTOM_CSS}}/g,
      this.options.customCSS || "/* No custom CSS */"
    );
    template = template.replace(/{{THEME}}/g, this.options.theme);

    // Add configuration object
    const config = {
      title: this.options.title,
      description: this.options.description,
      version: this.options.version,
      basePath: this.options.basePath,
      enableTesting: this.options.enableTesting,
      enableAuth: this.options.enableAuth,
      theme: this.options.theme,
    };

    template = template.replace(
      /\{\s*\{\s*CONFIG\s*\}\s*\}/g,
      `window.DASHBOARD_CONFIG = ${JSON.stringify(config, null, 2)};`
    );

    return template;
  }

  /**
   * Generate CSS based on theme
   * @returns {string} CSS content
   */
  generateCSS() {
    const cssPath = path.join(
      __dirname,
      `../templates/themes/${this.options.theme}.css`
    );

    if (fs.existsSync(cssPath)) {
      return fs.readFileSync(cssPath, "utf8");
    }

    // Fallback to dark theme
    const darkCssPath = path.join(__dirname, "../templates/themes/dark.css");
    return fs.readFileSync(darkCssPath, "utf8");
  }
}

module.exports = { DashboardGenerator };
