/**
 * @fileoverview Disallows inline type definitions that span multiple lines.
 * @author tuomashatakka
 */
"use strict";

// import all rules in lib/rules
export default {
  rules: {
    "no-inline-multiline-types": require("./rules/no-inline-multiline-types"),
  },
  // You could also define recommended configurations here
  // configs: {
  //   recommended: {
  //     plugins: ['no-inline-multiline-types'],
  //     rules: {
  //       'no-inline-multiline-types/no-inline-multiline-types': 'warn',
  //     }
  //   }
  // }
};