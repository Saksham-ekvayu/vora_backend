const registeredRoutes = [];

function registerRoutes(basePath, router) {
  registeredRoutes.push({ basePath, router });
}

function getRegisteredRoutes() {
  return registeredRoutes;
}

module.exports = { registerRoutes, getRegisteredRoutes };
