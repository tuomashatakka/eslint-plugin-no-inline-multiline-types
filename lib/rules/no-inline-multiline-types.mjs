/**
 * @fileoverview Disallows inline TSTypeLiteral annotations that span multiple lines.
 * @author tuomashatakka
 */

// Helper function to convert camelCase/snake_case to PascalCase
function toPascalCase(str) {
  if (!str) return '';
  // Handle snake_case first
  str = str.replace(/_([a-z])/g, (match, char) => char.toUpperCase());
  // Handle camelCase
  return str.charAt(0).toUpperCase() + str.slice(1);
}


//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallows inline TSTypeLiteral annotations",
      recommended: false,
      url: null,
    },
    fixable: "code", // Indicate that this rule provides fixes
    schema: [],
    messages: {
      inlineType: 'Inline type literal annotations are disallowed. Extract to a named interface or type alias.',
    },
  },

  create(context) {
    const sourceCode = context.getSourceCode(); // Get source code helper

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    /**
     * Finds the nearest ancestor node suitable for inserting a type definition before it.
     * Typically VariableDeclaration, FunctionDeclaration, ClassDeclaration, etc.,
     * at a statement level.
     * @param {import('@typescript-eslint/types').TSESTree.Node} startNode The node to start searching upwards from.
     * @returns {import('@typescript-eslint/types').TSESTree.Node | null} The ancestor node or null.
     */
    function findInsertionPointAncestor(startNode) {
      let currentNode = startNode;
      // Types of nodes we want to insert *before*
      const targetAncestorTypes = new Set([
        'VariableDeclaration',
        'FunctionDeclaration',
        'ClassDeclaration',
        'TSInterfaceDeclaration', // In case it's nested somehow
        'TSTypeAliasDeclaration', // In case it's nested somehow
        // Add other top-level-like structures if needed
      ]);
      // Types of parents where insertion is syntactically valid
      const validParentContextTypes = new Set([
        'Program', // Top level of the file
        'BlockStatement', // Inside a function body, etc.
        'ExportNamedDeclaration', // Handles `export const/function/class`
        'ExportDefaultDeclaration', // Handles `export default function/class`
        // Add module/namespace blocks if necessary
      ]);

      while (currentNode.parent) {
        // If the current node is a target type AND its parent is a valid context,
        // we've found our insertion point (the current node).
        if (targetAncestorTypes.has(currentNode.type) && currentNode.parent && validParentContextTypes.has(currentNode.parent.type)) {
          // Special case: If the valid parent is an export declaration,
          // we actually want to insert before the *export* statement itself.
          if (currentNode.parent.type === 'ExportNamedDeclaration' || currentNode.parent.type === 'ExportDefaultDeclaration') {
            return currentNode.parent;
          }
          return currentNode;
        }
        // If the current node itself is an export declaration containing a target type, insert before the export.
        if ((currentNode.type === 'ExportNamedDeclaration' || currentNode.type === 'ExportDefaultDeclaration') && currentNode.declaration && targetAncestorTypes.has(currentNode.declaration.type)) {
          return currentNode;
        }

        currentNode = currentNode.parent;
        // Stop if we hit the absolute top
        if (currentNode.type === 'Program') {
          // If we couldn't find a specific block, maybe insert at the top?
          // For now, let's assume we'll find one of the target ancestors.
          // If the startNode itself was top-level (unlikely for an annotation), return it.
          if (targetAncestorTypes.has(startNode.type)) return startNode;
          break; // Avoid infinite loops if something is wrong
        }
      }
      // Fallback: If no better place found, maybe return the original start node's statement?
      // This needs careful consideration, but finding the Variable/Function/Class declaration is preferred.
      // Let's return null if we didn't find a clear spot based on the logic above.
      // The calling code should handle this. Returning startNode might be too low level.
      console.warn("Could not reliably determine insertion point ancestor for fix.");
      return null;
    }

    /**
     * Tries to derive a meaningful name for the extracted type.
     * @param {import('@typescript-eslint/types').TSESTree.Node} typeAnnotationNode The TSTypeAnnotation node.
     * @returns {string} A suggested type name.
     */
    function deriveTypeName(typeAnnotationNode) {
      const parent = typeAnnotationNode.parent;
      if (!parent) return 'ExtractedType';

      try {
        // Case 1: Variable Declaration (let config: {...}) -> ConfigType
        if (parent.type === 'Identifier' && parent.parent && parent.parent.type === 'VariableDeclarator') {
          return toPascalCase(parent.name) + 'Type';
        }
        // Case 2: Function Parameter (function fn(config: {...})) -> ConfigType
        // Also handles constructor param props (private config: {...})
        if (parent.type === 'Identifier' && parent.parent && (parent.parent.type === 'FunctionDeclaration' || parent.parent.type === 'FunctionExpression' || parent.parent.type === 'ArrowFunctionExpression' || parent.parent.type === 'TSParameterProperty')) {
          // Check if it's a direct parameter identifier
          if (parent.parent.params && parent.parent.params.includes(parent)) {
            return toPascalCase(parent.name) + 'Type';
          }
          // Check if it's inside TSParameterProperty's parameter identifier
          if (parent.parent.type === 'TSParameterProperty' && parent.parent.parameter === parent) {
            return toPascalCase(parent.name) + 'Type';
          }
        }
        // Case 3: Object Pattern Parameter (function fn({ config }: {...})) -> PropsType (or similar)
        if (parent.type === 'ObjectPattern' && parent.parent && (parent.parent.type === 'FunctionDeclaration' || parent.parent.type === 'FunctionExpression' || parent.parent.type === 'ArrowFunctionExpression')) {
          // Try to find a relevant name from the function or fallback
          const funcName = parent.parent.id?.name;
          return funcName ? toPascalCase(funcName) + 'Props' : 'PropsType';
        }
        // Case 4: Array Pattern Parameter (function fn([ item1 ]: {...})) -> ParamsType
        if (parent.type === 'ArrayPattern' && parent.parent && (parent.parent.type === 'FunctionDeclaration' || parent.parent.type === 'FunctionExpression' || parent.parent.type === 'ArrowFunctionExpression')) {
          return 'ParamsType'; // Less specific
        }
        // Case 5: Class Property (class C { options: {...} }) -> OptionsType
        if (parent.type === 'PropertyDefinition' && parent.key && parent.key.type === 'Identifier') {
          return toPascalCase(parent.key.name) + 'Type';
        }
        // Case 6: Function Return Type (function getConfig(): {...}) -> GetConfigReturnType
        if ((parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ArrowFunctionExpression') && parent.returnType === typeAnnotationNode) {
          const funcName = parent.id?.name;
          // Handle anonymous functions or arrow functions assigned to vars
          if (!funcName && parent.parent && parent.parent.type === 'VariableDeclarator' && parent.parent.id.type === 'Identifier') {
            return toPascalCase(parent.parent.id.name) + 'ReturnType';
          }
          return toPascalCase(funcName || 'Function') + 'ReturnType';
        }
        // Case 7: TSParameterProperty (class C { constructor(config: {...}) }) -> ConfigType
        if (parent.type === 'TSParameterProperty' && parent.parameter && parent.parameter.type === 'Identifier') {
          return toPascalCase(parent.parameter.name) + 'Type';
        }

      } catch (e) {
        // Error during name derivation, fallback
        console.error("Error deriving type name:", e);
      }

      // Fallback name
      return 'ExtractedType';
    }


    /**
     * Checks if a type annotation node contains a multiline TSTypeLiteral.
     * Reports an error with a fix if it does.
     * @param {import('@typescript-eslint/types').TSESTree.Node | null | undefined} typeAnnotationNode The TSTypeAnnotation node.
     */
    function checkMultilineLiteralInAnnotation(typeAnnotationNode) {
      if (!typeAnnotationNode || typeAnnotationNode.type !== 'TSTypeAnnotation') {
        return;
      }

      const literalNode = typeAnnotationNode.typeAnnotation;

      if (literalNode && literalNode.type === 'TSTypeLiteral') {
          context.report({
            node: literalNode, // Report the TSTypeLiteral itself
            messageId: "inlineType",
            fix: function (fixer) {
              // --- Fix Logic ---
              const newTypeName = deriveTypeName(typeAnnotationNode);
              const literalText = sourceCode.getText(literalNode);
              const typeAliasString = `type ${newTypeName} = ${literalText};\n\n`;

              // Find where to insert the new type definition
              const insertionAncestor = findInsertionPointAncestor(typeAnnotationNode);

              if (!insertionAncestor) {
                // Cannot determine where to insert, don't apply fix
                console.warn(`Could not apply fix for node at line ${literalNode.loc.start.line}: insertion point not found.`);
                return null; // Indicate no fix is possible
              }

              // Create the two fixes: insert new type, replace old literal
              const insertFix = fixer.insertTextBefore(insertionAncestor, typeAliasString);
              const replaceFix = fixer.replaceText(literalNode, newTypeName);

              // Return both fixes (ESLint applies them safely)
              return [insertFix, replaceFix];
              // --- End Fix Logic ---
            }
          });
      }
    }

    //----------------------------------------------------------------------
    // Public - Visit specific nodes and check their annotations
    //----------------------------------------------------------------------

    return {
      VariableDeclarator(node) {
        if (node.id && node.id.typeAnnotation) {
          checkMultilineLiteralInAnnotation(node.id.typeAnnotation);
        }
      },
      PropertyDefinition(node) {
        if (node.typeAnnotation) {
          checkMultilineLiteralInAnnotation(node.typeAnnotation);
        }
      },
      ':function'(node) {
        if (node.returnType) {
          checkMultilineLiteralInAnnotation(node.returnType);
        }
        if (node.params) {
          for (const param of node.params) {
            if (param && param.typeAnnotation) {
              checkMultilineLiteralInAnnotation(param.typeAnnotation);
            }
            // Handle TSParameterProperty specifically if needed (though often covered by param.typeAnnotation)
            else if (param.type === 'TSParameterProperty' && param.parameter && param.parameter.typeAnnotation) {
              checkMultilineLiteralInAnnotation(param.parameter.typeAnnotation);
            }
          }
        }
      }
    }
  }
}

export default rule
