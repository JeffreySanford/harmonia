/**
 * ESLint Rule: No Standalone Angular Components
 * Enforces NgModule pattern throughout the application
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow standalone Angular components',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noStandalone:
        'Standalone components are not allowed. Use NgModule-based architecture.',
    },
    schema: [],
  },

  create(context) {
    return {
      // Check @Component decorators
      'Decorator[expression.callee.name="Component"]'(node) {
        const decoratorArgs = node.expression.arguments;
        if (decoratorArgs.length === 0) return;

        const configObject = decoratorArgs[0];
        if (configObject.type !== 'ObjectExpression') return;

        // Check for standalone: true
        const standaloneProperty = configObject.properties.find(
          (prop) =>
            prop.key &&
            prop.key.name === 'standalone' &&
            prop.value &&
            prop.value.value === true
        );

        if (standaloneProperty) {
          context.report({
            node: standaloneProperty,
            messageId: 'noStandalone',
          });
        }
      },
    };
  },
};
