const { getRegisteredRoutes } = require("./routeRegistry");

function listRoutes() {
  const routes = [];

  const registered = getRegisteredRoutes();

  registered.forEach(({ basePath, router }) => {
    router.stack.forEach((layer) => {
      if (!layer.route) return;

      const methods = Object.keys(layer.route.methods).map((m) =>
        m.toUpperCase()
      );

      routes.push({
        path: `${basePath}${layer.route.path}`,
        methods,
      });
    });
  });

  return routes;
}

module.exports = listRoutes;
